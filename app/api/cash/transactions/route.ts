import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;
  // @ts-expect-error
  const userId = session.user.id as string;

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");

  let cashSessionId = sessionId;

  if (!cashSessionId) {
    const open = await prisma.cashSession.findFirst({
      where: { companyId, userId, closedAt: null },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    } as any);
    cashSessionId = open?.id ?? null;
  }

  if (!cashSessionId) return NextResponse.json({ transactions: [] });

  const transactions = await prisma.cashTransaction.findMany({
    where: { sessionId: cashSessionId },
    orderBy: { createdAt: "desc" },
    take: 200,
  } as any);

  return NextResponse.json({ sessionId: cashSessionId, transactions });
}
