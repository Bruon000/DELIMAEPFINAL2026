import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = String(gate.session.user!.role ?? "");
  const orderId = ctx.params.id;

  const body = await req.json().catch(() => null);
  const percent = n(body?.discountPercent);

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return NextResponse.json({ error: "discountPercent_invalid" }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId, deletedAt: null } as any,
    select: { id: true, subtotal: true, status: true, createdById: true } as any,
  } as any);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String(order.status) !== "DRAFT" && String(order.status) !== "OPEN") {
    return NextResponse.json({ error: "order_not_editable", message: "Só é possível alterar desconto em pedido rascunho ou aberto." }, { status: 400 });
  }

  if (role === "VENDEDOR" && String(order.createdById ?? "") !== String(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // regra vendedor: até 5% sem aprovação
  if (role === "VENDEDOR" && percent > 5) {
    const approved = await prisma.orderDiscountApprovalRequest.findFirst({
      where: {
        companyId,
        orderId,
        status: "APPROVED" as any,
      } as any,
      orderBy: { updatedAt: "desc" } as any,
      select: { approvedPercent: true, requestedPercent: true, id: true } as any,
    } as any);

    const limit = Number(approved?.approvedPercent ?? 0);
    if (!approved?.id || limit <= 0 || percent > limit) {
      return NextResponse.json({
        error: "discount_requires_approval",
        message: "Desconto acima de 5% requer aprovação do ADMIN.",
        approvedLimit: limit || null,
      }, { status: 403 });
    }
  }

  const subtotal = n(order.subtotal);
  const discount = subtotal * (percent / 100);
  const total = Math.max(0, subtotal - discount);

  const updated = await prisma.order.update({
    where: { id: orderId } as any,
    data: {
      discountPercent: percent as any,
      discount: discount as any,
      total: total as any,
    } as any,
    select: { id: true, discountPercent: true, discount: true, total: true } as any,
  } as any);

  await writeAuditLog({
    companyId,
    userId,
    action: "ORDER_DISCOUNT_SET",
    entity: "ORDER",
    entityId: orderId,
    payload: { discountPercent: percent, discount, total },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, order: updated });
}
