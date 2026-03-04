import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;

  const body = await req.json().catch(() => null);
  const closingBalance = Number(body?.closingBalance ?? 0);
  const confirm = Boolean(body?.confirm ?? false);

  const cashSession = await prisma.cashSession.findFirst({
    where: { companyId, userId, closedAt: null },
    orderBy: { openedAt: "desc" },
  } as any);

  if (!cashSession) return NextResponse.json({ error: "no_open_session" }, { status: 400 });

  const txs = await prisma.cashTransaction.findMany({
    where: { sessionId: cashSession.id } as any,
    select: { type: true, amount: true } as any,
  } as any);

  const sumIn = (txs ?? []).filter((t: any) => t.type === "IN").reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);
  const sumOut = (txs ?? []).filter((t: any) => t.type === "OUT").reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);
  const opening = Number(cashSession.openingBalance ?? 0);
  const expectedBalance = opening + (sumIn - sumOut);
  const delta = Number(closingBalance ?? 0) - expectedBalance;

  // Se houver divergência relevante, exige confirmação explícita
  const EPS = 0.009; // ~1 centavo
  if (!confirm && Math.abs(delta) > EPS) {
    return NextResponse.json(
      {
        error: "closing_balance_mismatch",
        message: "Saldo informado diverge do saldo esperado. Confirme para fechar mesmo assim.",
        expectedBalance,
        closingBalance,
        delta,
      },
      { status: 409 }
    );
  }

  const updated = await prisma.cashSession.update({
    where: { id: cashSession.id } as any,
    data: { closedAt: new Date(), closingBalance } as any,
  } as any);

  await writeAuditLog({
    companyId,
    userId,
    action: "CASH_CLOSED",
    entity: "CASH_SESSION",
    entityId: updated.id,
    payload: { expectedBalance, closingBalance, delta },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ cashSession: updated });
}
