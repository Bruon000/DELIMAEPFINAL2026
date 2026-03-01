import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;
  // @ts-expect-error
  const userId = session.user.id as string;

  const cashSession = await prisma.cashSession.findFirst({
    where: { companyId, userId, closedAt: null },
    orderBy: { openedAt: "desc" },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 50 } },
  } as any);

  return NextResponse.json({ cashSession });
}
