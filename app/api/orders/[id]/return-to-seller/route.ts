import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const orderId = ctx.params.id;

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId, deletedAt: null },
  } as any);

  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  if (!["DRAFT", "OPEN"].includes(String(order.status))) {
    return NextResponse.json(
      { error: "invalid_status", message: "Só é possível devolver pedidos DRAFT ou OPEN ao vendedor." },
      { status: 409 },
    );
  }

  const hasAuthorizedInvoice = await prisma.fiscalInvoice.findFirst({
    where: { companyId, orderId, status: "AUTHORIZED" } as any,
    select: { id: true },
  } as any);

  if (hasAuthorizedInvoice) {
    return NextResponse.json(
      { error: "has_authorized_invoice", message: "Pedido possui nota autorizada. Cancele a nota antes de devolver." },
      { status: 409 },
    );
  }

  await prisma.order.update({
    where: { id: orderId } as any,
    data: { status: "DRAFT" as any, sentToCashierAt: null } as any,
  } as any);

  return NextResponse.json({ ok: true });
}
