import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const items = await prisma.accountsPayable.findMany({
    where: { companyId } as any,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] as any,
    take: 300,
  } as any);

  const now = new Date();
  const mapped = (items ?? []).map((ap: any) => {
    const amount = Number(ap.amount ?? 0);
    const dueDate = ap.dueDate ? new Date(ap.dueDate) : null;
    const isOverdue = ap.status === "PENDING" && dueDate ? dueDate < now : false;
    const statusUi = isOverdue ? "OVERDUE" : ap.status;
    return {
      id: ap.id,
      dueDate: ap.dueDate,
      amount,
      description: ap.description ?? null,
      status: statusUi,
      paidAt: ap.paidAt ?? null,
      createdAt: ap.createdAt,
      updatedAt: ap.updatedAt,
    };
  });

  return NextResponse.json({ items: mapped });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const body = await req.json().catch(() => null);

  const dueDateRaw = String(body?.dueDate ?? "").trim();
  const amount = Number(body?.amount ?? 0);
  const description = String(body?.description ?? "").trim() || null;

  if (!dueDateRaw) return NextResponse.json({ error: "dueDate_required" }, { status: 400 });
  const dueDate = new Date(dueDateRaw);
  if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: "dueDate_invalid" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount_invalid" }, { status: 400 });

  const created = await prisma.accountsPayable.create({
    data: {
      companyId,
      dueDate,
      amount,
      description,
      status: "PENDING" as any,
    } as any,
    select: { id: true },
  } as any);

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
