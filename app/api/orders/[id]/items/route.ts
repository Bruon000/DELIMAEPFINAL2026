import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const orderId = ctx.params.id;
  const body = await req.json().catch(() => null);

  const productId = String(body?.productId ?? "").trim();
  const quantity = Number(body?.quantity ?? 0);
  const unitPrice = Number(body?.unitPrice ?? 0);

  if (!productId || quantity <= 0) return NextResponse.json({ error: "invalid_item" }, { status: 400 });

  const order = await prisma.order.findFirst({ where: { id: orderId, companyId, deletedAt: null } });
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  const total = quantity * unitPrice;

  const item = await prisma.orderItem.create({
    data: {
      id: `oit_${Date.now()}`,
      orderId,
      productId,
      quantity,
      unitPrice,
      total,
    } as any,
  });

  return NextResponse.json({ item }, { status: 201 });
}
