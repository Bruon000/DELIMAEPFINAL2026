import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/**
 * GET /api/cash/sessions/[id]
 * Detalhe de uma sessão (aberta ou fechada): dados da sessão + transações + totais.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;
  const { id } = await ctx.params;

  const cashSession = await prisma.cashSession.findFirst({
    where: { id, companyId },
    include: {
      user: { select: { id: true, name: true } },
      transactions: { orderBy: { createdAt: "desc" } },
    },
  } as any);

  if (!cashSession) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const txs = (cashSession as any).transactions ?? [];
  const sumIn = txs.filter((t: any) => t.type === "IN").reduce((acc: number, t: any) => acc + n(t.amount), 0);
  const sumOut = txs.filter((t: any) => t.type === "OUT").reduce((acc: number, t: any) => acc + n(t.amount), 0);
  const opening = n(cashSession.openingBalance);
  const expectedBalance = opening + sumIn - sumOut;
  const closingBalance = (cashSession as any).closedAt != null ? n((cashSession as any).closingBalance) : null;

  return NextResponse.json({
    session: {
      id: cashSession.id,
      openedAt: (cashSession as any).openedAt,
      closedAt: (cashSession as any).closedAt,
      openingBalance: opening,
      closingBalance,
      expectedBalance,
      sumIn,
      sumOut,
      userName: (cashSession as any).user?.name ?? "—",
      userId: (cashSession as any).userId,
    },
    transactions: txs.map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: n(t.amount),
      description: t.description ?? null,
      reference: t.reference ?? null,
      createdAt: t.createdAt,
    })),
  });
}
