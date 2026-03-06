import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const orderId = ctx.params.id;

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId, deletedAt: null } as any,
    include: { items: { select: { total: true } } as any } as any,
  } as any);

  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (String(order.status) !== "DRAFT") {
    return NextResponse.json({ error: "order_not_draft", status: order.status }, { status: 400 });
  }

  // Se já existe AR pendente/paid pro pedido, reaproveita
  const existing = await prisma.accountsReceivable.findFirst({
    where: { companyId, orderId } as any,
    orderBy: { createdAt: "desc" } as any,
    select: { id: true, status: true } as any,
  } as any);
  if (existing) return NextResponse.json({ ok: true, accountsReceivableId: existing.id, status: existing.status });

  const amount = ((order as any).items ?? []).reduce((s: number, it: any) => s + n(it.total), 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "order_total_invalid" }, { status: 400 });
  }

  const ar = await prisma.accountsReceivable.create({
    data: {
      companyId,
      orderId,
      amount,
      status: "PENDING" as any,
      dueDate: new Date(),
    } as any,
    select: { id: true, status: true, amount: true } as any,
  } as any);

  return NextResponse.json({ ok: true, accountsReceivableId: ar.id, status: ar.status, amount: ar.amount }, { status: 201 });
}
