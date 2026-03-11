import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function sum(n: any) {
  return Number(n ?? 0);
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
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

  // ===== REGRA PDV: só confirma após pagamento (AR PAID) =====
  const paidAr = await prisma.accountsReceivable.findFirst({
    where: { companyId, orderId, status: "PAID" as any } as any,
    orderBy: { paidAt: "desc" } as any,
    select: { id: true, paidAt: true } as any,
  } as any);

  if (!paidAr) {
    return NextResponse.json(
      {
        error: "payment_required_before_confirm",
        message: "Pagamento não encontrado. Receba no PDV antes de confirmar.",
      },
      { status: 409 },
    );
  }

  // ===== REGRA: se pedido exige NFE, só confirma após NFE autorizada =====
  const requestedDocType = String((order as any)?.requestedDocType ?? "").toUpperCase();
  if (requestedDocType === "NFE") {
    const inv = await prisma.fiscalInvoice.findFirst({
      where: { companyId, orderId, docType: "NFE" as any } as any,
      select: { id: true, status: true } as any,
      orderBy: [{ createdAt: "desc" }] as any,
    } as any);

    if (!inv) {
      return NextResponse.json(
        { error: "fiscal_required_before_confirm", message: "Pedido com NFE: emita a NFE antes de confirmar." },
        { status: 409 },
      );
    }

    if (String(inv.status) !== "AUTHORIZED") {
      return NextResponse.json(
        {
          error: "fiscal_not_authorized",
          message: `NFE ainda não autorizada (status: ${inv.status}). Emita/aguarde autorização antes de confirmar.`,
          invoiceId: inv.id,
          invoiceStatus: inv.status,
        },
        { status: 409 },
      );
    }
  }

  const items = (order as any).items;
  if (!items?.length) return NextResponse.json({ error: "order_has_no_items" }, { status: 400 });

  // só confirma pedidos DRAFT ou OPEN (enviados ao caixa)
  const canConfirmStatus = ["DRAFT", "OPEN"].includes(String(order.status));
  if (!canConfirmStatus) {
    return NextResponse.json({ error: "order_already_confirmed", status: order.status }, { status: 400 });
  }

  // calcular materiais necessários via BOM
  const requiredByMaterial = new Map<string, number>();

  for (const it of items) {
    const qtyProduct = sum(it.quantity);
    const bom = (it.product as any)?.bom;
    if (!bom?.items?.length) continue;

    const lossBom = sum(bom.lossPercent) / 100;

    for (const bi of bom.items) {
      const base = sum(bi.quantity) * qtyProduct;
      const lossItem = sum((bi as any).lossPercent) / 100;
const need = base * (1 + lossBom) * (1 + lossItem);
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
  for (const [materialId, need] of Array.from(requiredByMaterial.entries())) {
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
  const total = items.reduce((acc: number, it: any) => acc + sum(it.total), 0);

  // transação: confirma pedido + reserva estoque + cria OP + cria AR + grava ledger
  const result = await prisma.$transaction(async (tx) => {
    // 1) confirmar pedido
    await tx.order.update({
      where: { id: orderId } as any,
      data: { status: "CONFIRMED" as any, confirmedAt: new Date(), confirmedById: userId } as any,
    });

    // 2) reservar estoque + ledger RESERVED
    for (const [materialId, need] of Array.from(requiredByMaterial.entries())) {
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
        companyId,
        orderId,
        status: "QUEUED" as any
      } as any,
      select: { id: true },
    } as any);

    // 4) criar AR se ainda não existir (PDV pode ter criado antes do pagamento)
    const existingAr = await tx.accountsReceivable.findFirst({
      where: { companyId, orderId } as any,
      orderBy: { createdAt: "desc" } as any,
      select: { id: true } as any,
    } as any);

    const ar = existingAr
      ? existingAr
      : await tx.accountsReceivable.create({
          data: {
            companyId,
            orderId,
            amount: total,
            status: "PENDING" as any,
            dueDate: new Date(),
          } as any,
          select: { id: true } as any,
        } as any);

    return { productionOrderId: po.id, accountsReceivableId: ar.id, total };
  });

  return NextResponse.json({ ok: true, message: "confirmed_and_op_created", ...result });
}

