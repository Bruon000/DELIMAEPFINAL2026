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

  const ar = await prisma.accountsReceivable.findFirst({
    where: { id, companyId },
    include: { order: true },
  } as any);

  if (!ar) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String(ar.status) === "PAID") return NextResponse.json({ error: "already_paid" }, { status: 400 });

  const amount = n(ar.amount);

  // opcional: payload { paidAt?: string, note?: string }
  const body = await req.json().catch(() => null);
  const paidAt = body?.paidAt ? new Date(String(body.paidAt)) : new Date();
  const note = String(body?.note ?? "").trim();

  const result = await prisma.$transaction(async (tx) => {
    // 1) Marcar AR como paga
    const updatedAr = await tx.accountsReceivable.update({
      where: { id } as any,
      data: { status: "PAID" as any, paidAt } as any,
    } as any);

    // 2) Garantir sessão de caixa aberta
    let sessionOpen = await tx.cashSession.findFirst({
      where: { companyId, userId, closedAt: null },
      orderBy: { openedAt: "desc" },
    } as any);

    if (!sessionOpen) {
      sessionOpen = await tx.cashSession.create({
        data: {
          companyId,
          userId,
          openedAt: new Date(),
          openingBalance: 0,
        } as any,
      } as any);
    }

    // 3) Registrar transação IN
    const description =
      note ||
      `Recebimento AR ${updatedAr.id} (Pedido ${(ar.order as any)?.id ?? ar.orderId})`;

    const cashTx = await tx.cashTransaction.create({
      data: {
        sessionId: sessionOpen.id,
        type: "IN",
        amount,
        description,
        // campos extras se existirem no schema (não quebra por causa do as any):
        accountsReceivableId: updatedAr.id,
        orderId: ar.orderId,
      } as any,
    } as any);

    return { cashSessionId: sessionOpen.id, cashTransactionId: cashTx.id, accountsReceivableId: updatedAr.id };
  });

  return NextResponse.json({ ok: true, ...result });
}
