import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function n(x: any) { return Number(x ?? 0); }

async function recalcOrder(tx: any, orderId: string) {
  const items = await tx.orderItem.findMany({
    where: { orderId } as any,
    select: { total: true } as any,
  } as any);

  const subtotal = items.reduce((s: number, it: any) => s + n(it.total), 0);

  const order = await tx.order.findFirst({
    where: { id: orderId } as any,
    select: { discount: true } as any,
  } as any);

  const discount = n(order?.discount);
  const total = Math.max(0, subtotal - discount);

  await tx.order.update({
    where: { id: orderId } as any,
    data: { subtotal, total } as any,
  } as any);
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = String((gate.session.user as any)?.role ?? "");

  const orderId = ctx.params.id;
  const body = await req.json().catch(() => null);

  const productId = String(body?.productId ?? "").trim();
  const quantity = n(body?.quantity);
  const unitPrice = n(body?.unitPrice);

  if (!productId || quantity <= 0) {
    return NextResponse.json({ error: "invalid_item" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({ where: { id: orderId, companyId, deletedAt: null } } as any);
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  if (role === "VENDEDOR" && String((order as any).createdById ?? "") !== String(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const total = quantity * unitPrice;

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.orderItem.create({
      data: {
        id: `oit_${Date.now()}`,
        orderId,
        productId,
        quantity,
        unitPrice,
        total,
      } as any,
      include: { product: { select: { id: true, name: true, code: true } } as any },
    } as any);

    await recalcOrder(tx, orderId);
    return created;
  });

  return NextResponse.json({ item }, { status: 201 });
}
