import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export async function POST(req: Request) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;

  const body = await req.json().catch(() => ({}));
  const orderId = String(body?.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "missing_orderId" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId, deletedAt: null } as any,
    include: { items: { select: { total: true } } as any } as any,
  } as any);

  if (!order?.id) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  const allowedStatuses = ["DRAFT", "OPEN"];
  if (!allowedStatuses.includes(String((order as any).status))) {
    return NextResponse.json(
      { error: "invalid_order_status", message: "Somente pedido DRAFT/OPEN pode gerar contas a receber no PDV." },
      { status: 409 }
    );
  }

  if (!(order as any).sentToCashierAt) {
    return NextResponse.json(
      { error: "order_not_sent_to_cashier", message: "Envie o pedido ao caixa antes de criar o recebível." },
      { status: 409 }
    );
  }

  const existing = await prisma.accountsReceivable.findFirst({
    where: {
      companyId,
      orderId,
      status: { in: ["PENDING", "PAID"] } as any,
    } as any,
    select: { id: true, status: true } as any,
  } as any);

  if (existing?.id) {
    return NextResponse.json(
      { error: "ar_already_exists", id: existing.id, status: existing.status },
      { status: 409 }
    );
  }

  const computedTotal = ((order as any).items ?? []).reduce((s: number, it: any) => s + n(it.total), 0);
  const amount = body?.amount != null ? n(body.amount) : computedTotal;
  if (!(amount > 0)) {
    return NextResponse.json(
      { error: "invalid_amount", message: "amount deve ser > 0 (ou deixe vazio para usar o total do pedido)." },
      { status: 400 }
    );
  }

  const installments = Math.max(1, Math.min(60, n((order as any).installments) || 1));
  const dueDays = n((order as any).dueDays);
  const intervalDays = Math.max(1, Math.min(365, n((order as any).intervalDays) || 30));
  const isParcelado = installments > 1;

  function addDays(d: Date, days: number) {
    const out = new Date(d);
    out.setDate(out.getDate() + days);
    return out;
  }

  if (isParcelado) {
    const parcelAmount = Math.round((amount / installments) * 100) / 100;
    const firstDueDays = dueDays > 0 ? dueDays : intervalDays;
    const ars: any[] = [];
    for (let i = 0; i < installments; i++) {
      const dueDate = addDays(new Date(), firstDueDays + i * intervalDays);
      const ar = await prisma.accountsReceivable.create({
        data: {
          companyId,
          orderId,
          dueDate,
          amount: parcelAmount as any,
          status: "PENDING" as any,
        } as any,
        select: {
          id: true,
          orderId: true,
          dueDate: true,
          amount: true,
          status: true,
          paidAt: true,
          paidAmount: true,
          createdAt: true,
        } as any,
      } as any);
      ars.push(ar);
    }
    return NextResponse.json({ ok: true, ar: ars[0], ars, installments: ars.length }, { status: 201 });
  }

  const singleDueDate = addDays(new Date(), dueDays);
  const ar = await prisma.accountsReceivable.create({
    data: {
      companyId,
      orderId,
      dueDate: singleDueDate,
      amount: amount as any,
      status: "PENDING" as any,
    } as any,
    select: {
      id: true,
      orderId: true,
      dueDate: true,
      amount: true,
      status: true,
      paidAt: true,
      paidAmount: true,
      createdAt: true,
    } as any,
  } as any);

  return NextResponse.json({ ok: true, ar }, { status: 201 });
}
