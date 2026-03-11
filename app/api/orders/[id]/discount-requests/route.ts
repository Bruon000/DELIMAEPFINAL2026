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
  const requestedPercent = n(body?.requestedPercent);
  const reason = String(body?.reason ?? "").trim();

  if (!Number.isFinite(requestedPercent) || requestedPercent <= 5 || requestedPercent > 100) {
    return NextResponse.json({
      error: "requestedPercent_invalid",
      message: "Informe um percentual entre 5,01 e 100%.",
    }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId, deletedAt: null } as any,
    select: { id: true, status: true, createdById: true } as any,
  } as any);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String(order.status) !== "DRAFT" && String(order.status) !== "OPEN") {
    return NextResponse.json({ error: "order_not_editable" }, { status: 400 });
  }

  if (role === "VENDEDOR" && String(order.createdById ?? "") !== String(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const existing = await prisma.orderDiscountApprovalRequest.findFirst({
    where: { orderId, companyId, status: "PENDING" as any } as any,
  } as any);
  if (existing) {
    return NextResponse.json({
      error: "pending_request_exists",
      message: "Já existe solicitação de desconto pendente para este pedido.",
    }, { status: 409 });
  }

  const created = await prisma.orderDiscountApprovalRequest.create({
    data: {
      companyId,
      orderId,
      requestedById: userId,
      requestedPercent: requestedPercent as any,
      reason: reason || null,
      status: "PENDING" as any,
    } as any,
    select: { id: true, requestedPercent: true, status: true } as any,
  } as any);

  await writeAuditLog({
    companyId,
    userId,
    action: "ORDER_DISCOUNT_REQUEST_CREATED",
    entity: "ORDER",
    entityId: orderId,
    payload: { requestId: created.id, requestedPercent },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    request: created,
    message: "Solicitação enviada. Aguarde aprovação do admin em Admin → Descontos.",
  });
}
