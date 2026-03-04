import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const q = String(url.searchParams.get("q") ?? "").trim().toLowerCase();
  const type = String(url.searchParams.get("type") ?? "").trim().toUpperCase();

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

  const filtered = (transactions ?? []).filter((t: any) => {
    if (type && type !== "ALL" && String(t.type ?? "").toUpperCase() !== type) return false;
    if (!q) return true;
    const desc = String(t.description ?? "").toLowerCase();
    const ref = String(t.reference ?? "").toLowerCase();
    return desc.includes(q) || ref.includes(q);
  });

  return NextResponse.json({ sessionId: cashSessionId, transactions: filtered });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;

  const body = await req.json().catch(() => null);
  const type = String(body?.type ?? "").toUpperCase();
  const amount = Number(body?.amount ?? 0);
  const description = String(body?.description ?? "").trim() || null;
  const reference = String(body?.reference ?? "").trim() || null;

  if (type !== "IN" && type !== "OUT") return NextResponse.json({ error: "type_invalid" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount_invalid" }, { status: 400 });

  const open = await prisma.cashSession.findFirst({
    where: { companyId, userId, closedAt: null },
    orderBy: { openedAt: "desc" },
    select: { id: true },
  } as any);

  if (!open?.id) return NextResponse.json({ error: "cash_not_open" }, { status: 400 });

  const tx = await prisma.cashTransaction.create({
    data: {
      sessionId: open.id,
      type: type as any,
      amount,
      description,
      reference,
    } as any,
    select: { id: true },
  } as any);

  await writeAuditLog({
    companyId,
    userId,
    action: "CASH_TX_CREATED",
    entity: "CASH_SESSION",
    entityId: open.id,
    payload: { type, amount, description, reference, txId: tx.id },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, id: tx.id }, { status: 201 });
}
