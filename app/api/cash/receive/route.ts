import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;

  const body = await req.json().catch(() => null);
  const arId = String(body?.accountsReceivableId ?? "").trim();
  const note = String(body?.note ?? "").trim();
  const paidAt = body?.paidAt ? new Date(String(body.paidAt)) : new Date();

  if (!arId) return NextResponse.json({ error: "accountsReceivableId_required" }, { status: 400 });

  const open = await prisma.cashSession.findFirst({
    where: { companyId, userId, closedAt: null } as any,
    orderBy: { openedAt: "desc" } as any,
    select: { id: true } as any,
  } as any);

  if (!open?.id) {
    return NextResponse.json(
      { error: "cash_not_open", message: "Abra o caixa antes de receber pagamentos." },
      { status: 400 }
    );
  }

  const ar = await prisma.accountsReceivable.findFirst({
    where: { id: arId, companyId } as any,
    include: { order: true } as any,
  } as any);

  if (!ar) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String(ar.status ?? "") === "PAID") return NextResponse.json({ error: "already_paid" }, { status: 400 });

  const amount = n(ar.amount);
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount_invalid" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.accountsReceivable.update({
      where: { id: arId } as any,
      data: { status: "PAID" as any, paidAt } as any,
    } as any);

    const description = note || `Recebimento AR ${updated.id} (Pedido ${ar.orderId})`;

    const cashTx = await tx.cashTransaction.create({
      data: {
        sessionId: open.id,
        type: "IN" as any,
        amount,
        description,
        reference: `AR:${updated.id}`,
      } as any,
      select: { id: true } as any,
    } as any);

    return { cashSessionId: open.id, cashTransactionId: cashTx.id, accountsReceivableId: updated.id };
  });

  await writeAuditLog({
    companyId,
    userId,
    action: "CASH_RECEIVED_AR",
    entity: "ACCOUNTS_RECEIVABLE",
    entityId: arId,
    payload: { ...result, amount },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, ...result }, { status: 201 });
}
