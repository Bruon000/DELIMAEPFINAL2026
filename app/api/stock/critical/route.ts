import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized", message: "Não autorizado" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const url = new URL(req.url);

  const q = String(url.searchParams.get("q") ?? "").trim();
  const mode = String(url.searchParams.get("mode") ?? "available").trim(); // available | total
  const take = Math.min(Math.max(n(url.searchParams.get("take")), 1) || 200, 400);

  // Puxa materiais com minStock definido (>0)
  const mats = await prisma.material.findMany({
    where: {
      companyId,
      deletedAt: null,
      minStock: { gt: 0 } as any,
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: "insensitive" } as any },
              { name: { contains: q, mode: "insensitive" } as any },
              { code: { contains: q, mode: "insensitive" } as any },
            ],
          }
        : {}),
    } as any,
    take,
    orderBy: { updatedAt: "desc" } as any,
    select: { id: true, name: true, code: true, minStock: true, unitId: true },
  } as any);

  const ids = mats.map((m: any) => m.id);

  const stocks = await prisma.stockItem.findMany({
    where: { materialId: { in: ids } } as any,
    select: { materialId: true, quantity: true, reserved: true, updatedAt: true },
  } as any);

  const sm = new Map(stocks.map((s: any) => [s.materialId, s]));

  const rows = mats
    .map((m: any) => {
      const s = sm.get(m.id);
      const qty = n(s?.quantity);
      const res = n(s?.reserved);
      const available = qty - res;
      const minStock = n(m.minStock);

      const metric = mode === "total" ? qty : available;
      const critical = metric + 1e-9 < minStock;

      return {
        materialId: m.id,
        minStock,
        quantity: qty,
        reserved: res,
        available,
        critical,
        material: { id: m.id, name: m.name, code: m.code ?? null },
      };
    })
    .filter((r: any) => r.critical)
    .sort((a: any, b: any) => (a.available - a.minStock) - (b.available - b.minStock));

  return NextResponse.json({ ok: true, rows });
}
