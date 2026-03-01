import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;
  // @ts-expect-error
  const userId = session.user.id as string;

  const body = await req.json().catch(() => null);
  const closingBalance = Number(body?.closingBalance ?? 0);

  const cashSession = await prisma.cashSession.findFirst({
    where: { companyId, userId, closedAt: null },
    orderBy: { openedAt: "desc" },
  } as any);

  if (!cashSession) return NextResponse.json({ error: "no_open_session" }, { status: 400 });

  const updated = await prisma.cashSession.update({
    where: { id: cashSession.id } as any,
    data: { closedAt: new Date(), closingBalance } as any,
  } as any);

  return NextResponse.json({ cashSession: updated });
}
