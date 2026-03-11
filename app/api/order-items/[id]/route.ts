import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

async function recalcOrder(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId } as any,
    select: { total: true } as any,
  } as any);
  const subtotal = items.reduce((s: number, it: any) => s + n(it.total), 0);
  const order = await prisma.order.findFirst({
    where: { id: orderId } as any,
    select: { discount: true, discountPercent: true } as any,
  } as any);
  const pct = n(order?.discountPercent);
  const discount = pct > 0 ? subtotal * (pct / 100) : n(order?.discount);
  const total = Math.max(0, subtotal - discount);
  await prisma.order.update({
    where: { id: orderId } as any,
    data: { subtotal, discount, total } as any,
  } as any);
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const itemId = ctx.params.id;
  const body = await req.json().catch(() => ({}));
  const quantity = n(body?.quantity);

  if (!Number.isFinite(quantity) || quantity < 0.0001) {
    return NextResponse.json({ error: "invalid_quantity" }, { status: 400 });
  }

  const item = await prisma.orderItem.findFirst({
    where: { id: itemId },
    include: { order: true },
  });

  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (item.order.companyId !== companyId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const unitPrice = n(item.unitPrice);
  const total = quantity * unitPrice;

  await prisma.orderItem.update({
    where: { id: itemId } as any,
    data: { quantity, total } as any,
  } as any);
  await recalcOrder(item.orderId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const item = await prisma.orderItem.findFirst({
    where: { id },
    include: { order: true },
  });

  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (item.order.companyId !== companyId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const orderId = item.orderId;
  await prisma.orderItem.delete({ where: { id } as any });
  await recalcOrder(orderId);
  return NextResponse.json({ ok: true });
}
