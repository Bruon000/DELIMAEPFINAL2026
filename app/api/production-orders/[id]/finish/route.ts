import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;
  // @ts-expect-error
  const userId = session.user.id as string;

  const id = ctx.params.id;

  const op = await prisma.productionOrder.findFirst({
    where: { id, companyId },
    include: {
      order: {
        include: {
          items: {
            include: {
              product: { include: { bom: { include: { items: true } } } as any },
            },
          },
        },
      },
    },
  } as any);

  if (!op) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // calcular consumo
  const requiredByMaterial = new Map<string, number>();
  for (const it of op.order?.items ?? []) {
    const qtyProduct = n(it.quantity);
    const bom = (it.product as any)?.bom;
    if (!bom?.items?.length) continue;

    const loss = n(bom.lossPercent) / 100;
    for (const bi of bom.items) {
      const base = n(bi.quantity) * qtyProduct;
      const need = base * (1 + loss);
      requiredByMaterial.set(bi.materialId, (requiredByMaterial.get(bi.materialId) ?? 0) + need);
    }
  }

  const materialIds = Array.from(requiredByMaterial.keys());

  const stock = await prisma.stockItem.findMany({
    where: { materialId: { in: materialIds } },
    select: { materialId: true, quantity: true, reserved: true },
  });

  const stockMap = new Map(stock.map(s => [s.materialId, { qty: n(s.quantity), res: n(s.reserved) }]));

  // valida: reserved tem que cobrir o consumo (porque reservamos no confirm)
  const issues: any[] = [];
  for (const [mid, need] of requiredByMaterial.entries()) {
    const s = stockMap.get(mid) ?? { qty: 0, res: 0 };
    if (s.res + 1e-9 < need) issues.push({ materialId: mid, need, reserved: s.res });
    if (s.qty + 1e-9 < need) issues.push({ materialId: mid, need, quantity: s.qty });
  }
  if (issues.length) return NextResponse.json({ error: "stock_inconsistent", issues }, { status: 409 });

  await prisma.$transaction(async (tx) => {
    for (const [mid, need] of requiredByMaterial.entries()) {
      const s = stockMap.get(mid)!;
      const newQty = s.qty - need;
      const newRes = s.res - need;

      await tx.stockItem.update({
        where: { materialId: mid } as any,
        data: {
          reserved: newRes,
          quantity: newQty,
          updatedAt: new Date(),
        } as any,
      });

      // ledger CONSUMED: quantity negativa, balance = novo saldo
      await tx.stockLedger.create({
        data: {
          materialId: mid,
          type: "CONSUMED" as any,
          quantity: -need,
          balance: newQty,
          reference: id, // ProductionOrder.id
          note: "Consumo ao finalizar produção",
          createdBy: userId,
        } as any,
      } as any);
    }

    await tx.productionOrder.update({
      where: { id } as any,
      data: { status: "DONE" as any, finishedAt: new Date() } as any,
    } as any);
  });

  return NextResponse.json({ ok: true });
}
