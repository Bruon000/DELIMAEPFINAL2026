import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const orderId = ctx.params.id;

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId, deletedAt: null },
    include: {
      items: {
        include: {
          product: { include: { bom: { include: { items: true } } } as any },
        },
      },
    },
  } as any);

  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const required = new Map<string, number>();

  for (const it of order.items ?? []) {
    const qtyProduct = n(it.quantity);
    const bom = (it.product as any)?.bom;
    if (!bom?.items?.length) continue;

    const loss = n(bom.lossPercent) / 100;

    for (const bi of bom.items) {
      const base = n(bi.quantity) * qtyProduct;
      const need = base * (1 + loss);
      required.set(bi.materialId, (required.get(bi.materialId) ?? 0) + need);
    }
  }

  const materialIds = Array.from(required.keys());

  const materials = await prisma.material.findMany({
    where: { id: { in: materialIds } },
    select: { id: true, name: true, code: true, minStock: true },
  });

  const stock = await prisma.stockItem.findMany({
    where: { materialId: { in: materialIds } },
    select: { materialId: true, quantity: true, reserved: true },
  });

  const matMap = new Map(materials.map((m) => [m.id, m]));
  const stockMap = new Map(stock.map((s) => [s.materialId, s]));

  const rows = materialIds.map((mid) => {
    const m = matMap.get(mid);
    const s: any = stockMap.get(mid) ?? { quantity: 0, reserved: 0 };
    const need = required.get(mid) ?? 0;
    const qty = n(s.quantity);
    const res = n(s.reserved);
    const available = qty - res;
    return {
      materialId: mid,
      code: m?.code ?? null,
      name: m?.name ?? mid,
      minStock: m?.minStock ?? null,
      need,
      quantity: qty,
      reserved: res,
      available,
      ok: available + 1e-9 >= need,
    };
  });

  const shortages = rows.filter((r) => !r.ok).map((r) => ({
    materialId: r.materialId,
    name: r.name,
    need: r.need,
    available: r.available,
  }));

  return NextResponse.json({ rows, shortages });
}
