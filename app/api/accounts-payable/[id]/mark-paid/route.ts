import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;
  const id = ctx.params.id;

  const ap = await prisma.accountsPayable.findFirst({ where: { id, companyId } as any } as any);
  if (!ap) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String(ap.status ?? "") === "PAID") return NextResponse.json({ ok: true, alreadyPaid: true });

  const open = await prisma.cashSession.findFirst({
    where: { companyId, userId, closedAt: null } as any,
    orderBy: { openedAt: "desc" } as any,
    select: { id: true } as any,
  } as any);

  if (!open?.id) {
    return NextResponse.json(
      { error: "cash_not_open", message: "Abra o caixa para marcar a despesa como paga (gera OUT)." },
      { status: 400 }
    );
  }

  const now = new Date();
  const amount = Number(ap.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount_invalid" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.accountsPayable.update({
      where: { id } as any,
      data: { status: "PAID" as any, paidAt: now } as any,
    } as any);

    await tx.cashTransaction.create({
      data: {
        sessionId: open.id,
        type: "OUT" as any,
        amount,
        description: ap.description ? `Pagamento: ${ap.description}` : "Pagamento de despesa",
        reference: `AP:${id}`,
      } as any,
    } as any);
  });

  return NextResponse.json({ ok: true });
}
