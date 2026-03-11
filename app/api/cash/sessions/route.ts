import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/**
 * GET /api/cash/sessions?closed=true
 * Lista sessões de caixa. Se closed=true, retorna apenas sessões fechadas (com resumo).
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const url = new URL(req.url);
  const closed = url.searchParams.get("closed") === "true";
  const take = Math.min(Number(url.searchParams.get("take")) || 50, 100);

  const where: any = { companyId };
  if (closed) where.closedAt = { not: null };
  else where.closedAt = null;

  const sessions = await prisma.cashSession.findMany({
    where,
    orderBy: closed ? { closedAt: "desc" } : { openedAt: "desc" },
    take,
    include: {
      user: { select: { id: true, name: true } },
      transactions: { select: { type: true, amount: true } },
    },
  } as any);

  const list = sessions.map((s: any) => {
    const txs = s.transactions ?? [];
    const sumIn = txs.filter((t: any) => t.type === "IN").reduce((acc: number, t: any) => acc + n(t.amount), 0);
    const sumOut = txs.filter((t: any) => t.type === "OUT").reduce((acc: number, t: any) => acc + n(t.amount), 0);
    const opening = n(s.openingBalance);
    const expectedBalance = opening + sumIn - sumOut;
    const closingBalance = s.closedAt != null ? n(s.closingBalance) : null;
    return {
      id: s.id,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      openingBalance: opening,
      closingBalance,
      expectedBalance,
      sumIn,
      sumOut,
      userName: s.user?.name ?? "—",
      userId: s.userId,
    };
  });

  return NextResponse.json({ sessions: list });
}
