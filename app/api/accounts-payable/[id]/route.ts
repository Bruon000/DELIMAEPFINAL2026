import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;
  const id = ctx.params.id;

  const ap = await prisma.accountsPayable.findFirst({
    where: { id, companyId } as any,
  } as any);

  if (!ap) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    item: {
      id: ap.id,
      dueDate: ap.dueDate,
      amount: Number(ap.amount ?? 0),
      description: ap.description ?? null,
      status: ap.status,
      paidAt: ap.paidAt ?? null,
      createdAt: ap.createdAt,
      updatedAt: ap.updatedAt,
    },
  });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const exists = await prisma.accountsPayable.findFirst({ where: { id, companyId } as any } as any);
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data: any = {};
  if (body?.description != null) data.description = String(body.description).trim() || null;
  if (body?.amount != null) {
    const amount = Number(body.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount_invalid" }, { status: 400 });
    data.amount = amount;
  }
  if (body?.dueDate != null) {
    const dueDate = new Date(String(body.dueDate));
    if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: "dueDate_invalid" }, { status: 400 });
    data.dueDate = dueDate;
  }
  if (body?.status != null) {
    const s = String(body.status ?? "").toUpperCase();
    if (!["PENDING", "PAID", "OVERDUE", "CANCELED"].includes(s)) return NextResponse.json({ error: "status_invalid" }, { status: 400 });
    data.status = s as any;
    if (s === "PAID" && !exists.paidAt) data.paidAt = new Date();
    if (s !== "PAID") data.paidAt = null;
  }

  const updated = await prisma.accountsPayable.update({
    where: { id } as any,
    data,
    select: { id: true },
  } as any);

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;
  const id = ctx.params.id;

  const exists = await prisma.accountsPayable.findFirst({ where: { id, companyId } as any } as any);
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.accountsPayable.delete({ where: { id } as any } as any);
  return NextResponse.json({ ok: true });
}
