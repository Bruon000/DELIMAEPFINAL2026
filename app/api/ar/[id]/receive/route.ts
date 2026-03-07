import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const id = String(ctx.params.id);

  const ar0 = await prisma.accountsReceivable.findFirst({
    where: { id, companyId } as any,
    select: { id: true, status: true, amount: true } as any,
  } as any);

  if (!ar0?.id) return NextResponse.json({ error: "ar_not_found" }, { status: 404 });

  if (ar0.status === ("PAID" as any)) {
    return NextResponse.json({ error: "already_paid" }, { status: 409 });
  }
  if (ar0.status !== ("PENDING" as any)) {
    return NextResponse.json({ error: "invalid_status", status: ar0.status }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const paidAmount = body?.paidAmount != null ? n(body.paidAmount) : n(ar0.amount);
  if (!(paidAmount > 0)) {
    return NextResponse.json({ error: "invalid_paidAmount" }, { status: 400 });
  }

  const ar = await prisma.accountsReceivable.update({
    where: { id } as any,
    data: {
      status: "PAID" as any,
      paidAt: new Date(),
      paidAmount: paidAmount as any,
    } as any,
    select: {
      id: true,
      orderId: true,
      status: true,
      dueDate: true,
      amount: true,
      paidAt: true,
      paidAmount: true,
      updatedAt: true,
    } as any,
  } as any);

  return NextResponse.json({ ok: true, ar });
}
