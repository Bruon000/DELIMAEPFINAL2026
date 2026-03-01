import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function sum(n: any) {
  return Number(n ?? 0);
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // @ts-expect-error
  const companyId = session.user.companyId as string;
  // @ts-expect-error
  const userId = session.user.id as string;

  const orderId = ctx.params.id;

  // Carrega pedido + itens + BOM dos produtos + estoque
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId, deletedAt: null },
    include: {
      items: {
        include: {
          product: {
            include: {
              bom: { include: { items: true } },
            } as any,
          },
        },
      },
    },
  } as any);

  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (!order.items?.length) return NextResponse.json({ error: "order_has_no_items" }, { status: 400 });

  // se já confirmado, não faz de novo
  if (String(order.status) !== "DRAFT") {
    return NextResponse.json({ error: "order_not_draft", status: order.status }, { status: 400 });
  }

  // calcular materiais necessários via BOM
  const requiredByMaterial = new Map<string, number>();

  for (const it of order.items) {
    const qtyProduct = sum(it.quantity);
    const bom = (it.product as any)?.bom;
    if (!bom?.items?.length) continue;

    const loss = sum(bom.lossPercent) / 100;

    for (const bi of bom.items) {
      const base = sum(bi.quantity) * qtyProduct;
      const need = base * (1 + loss);
      requiredByMaterial.set(bi.materialId, (requiredByMaterial.get(bi.materialId) ?? 0) + need);
    }
  }

  const materialIds = Array.from(requiredByMaterial.keys());

  // buscar estoque atual
  const stock = await prisma.stockItem.findMany({
    where: { materialId: { in: materialIds } },
    select: { materialId: true, quantity: true, reserved: true },
  });

  const stockMap = new Map(stock.map((s) => [s.materialId, { qty: sum(s.quantity), res: sum(s.reserved) }]));

  // validar disponibilidade: (qty - reserved) >= need
  const shortages: any[] = [];
  for (const [materialId, need] of requiredByMaterial.entries()) {
    const s = stockMap.get(materialId) ?? { qty: 0, res: 0 };
    const available = s.qty - s.res;
    if (available + 1e-9 < need) {
      shortages.push({ materialId, need, available });
    }
  }

  if (shortages.length) {
    return NextResponse.json({ error: "insufficient_stock", shortages }, { status: 409 });
  }

  // total do pedido
  const total = order.items.reduce((acc: number, it: any) => acc + sum(it.total), 0);

  // transação: confirma pedido + reserva estoque + cria OP + cria AR + grava ledger
  const result = await prisma.$transaction(async (tx) => {
    // 1) confirmar pedido
    await tx.order.update({
      where: { id: orderId } as any,
      data: { status: "CONFIRMED" as any, confirmedAt: new Date() } as any,
    });

    // 2) reservar estoque + ledger RESERVED
    for (const [materialId, need] of requiredByMaterial.entries()) {
      const current = stockMap.get(materialId)!;
      const newReserved = current.res + need;

      await tx.stockItem.update({
        where: { materialId } as any,
        data: { reserved: newReserved, updatedAt: new Date() } as any,
      });

      // balance = quantity (não muda na reserva), quantity do ledger = necessidade reservada
      await tx.stockLedger.create({
        data: {
          materialId,
          type: "RESERVED" as any,
          quantity: need,
          balance: current.qty,
          reference: orderId,
          note: "Reserva ao confirmar pedido",
          createdBy: userId,
        } as any,
      } as any);
    }

    // 3) criar OP (ProductionOrder)
    const po = await tx.productionOrder.create({
      data: {
        id: `po_${Date.now()}`,
        companyId,
        orderId,
        status: "PENDING" as any,
        createdById: userId,
      } as any,
      select: { id: true },
    } as any);

    // 4) criar AR (AccountsReceivable) mínimo 1 parcela
    const ar = await tx.accountsReceivable.create({
      data: {
        id: `ar_${Date.now()}`,
        companyId,
        orderId,
        amount: total,
        status: "OPEN" as any,
        dueDate: new Date(),
      } as any,
      select: { id: true },
    } as any);

    return { productionOrderId: po.id, accountsReceivableId: ar.id, total };
  });

  return NextResponse.json({ ok: true, ...result });
}
