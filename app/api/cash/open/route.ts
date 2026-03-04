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
  const openingBalance = Number(body?.openingBalance ?? 0);

  const existing = await prisma.cashSession.findFirst({
    where: { companyId, userId, closedAt: null },
    orderBy: { openedAt: "desc" },
  } as any);

  if (existing) return NextResponse.json({ error: "already_open", cashSession: existing }, { status: 400 });

  const cashSession = await prisma.cashSession.create({
    data: { companyId, userId, openingBalance } as any,
  } as any);

  await writeAuditLog({
    companyId,
    userId,
    action: "CASH_OPENED",
    entity: "CASH_SESSION",
    entityId: cashSession.id,
    payload: { openingBalance },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ cashSession }, { status: 201 });
}
