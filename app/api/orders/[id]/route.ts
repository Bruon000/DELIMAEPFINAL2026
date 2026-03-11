import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = String((gate.session.user as any)?.role ?? "");

  const id = ctx.params.id;

  const order = await prisma.order.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      client: {
        select: {
          id: true, name: true, document: true, tradeName: true,
          phone: true, email: true,
          addressStreet: true, addressNumber: true,
          addressDistrict: true, addressCity: true, addressState: true,
          addressZip: true, cityCodeIbge: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
      confirmedBy: { select: { id: true, name: true } },
      items: {
        include: {
          product: {
            select: {
              id: true, name: true, code: true,
              fiscal: { select: { origin: true, ncm: true, cfop: true, cst: true, csosn: true, cest: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  } as any);

  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (role === "VENDEDOR" && String((order as any).createdById ?? "") !== String(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [lastInvoice, arRecords, discountApproval] = await Promise.all([
    prisma.fiscalInvoice.findFirst({
      where: { orderId: id, companyId } as any,
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, docType: true, number: true, key: true },
    }),
    prisma.accountsReceivable.findMany({
      where: { orderId: id, companyId } as any,
      select: { id: true, status: true, amount: true, paidAmount: true, paidAt: true },
    }),
    prisma.orderDiscountApprovalRequest.findFirst({
      where: { orderId: id, companyId } as any,
      orderBy: { updatedAt: "desc" } as any,
      select: { id: true, status: true, requestedPercent: true, approvedPercent: true } as any,
    } as any),
  ]);

  const arPaid = arRecords.some((ar: any) => ar.status === "PAID");

  return NextResponse.json({
    order,
    fiscal: lastInvoice ?? null,
    payment: { records: arRecords, anyPaid: arPaid },
    discountApproval: discountApproval ?? null,
  });
}

const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  CONFIRMED: ["IN_PRODUCTION"],
  IN_PRODUCTION: ["READY"],
  READY: ["DELIVERED"],
};

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR", "PRODUCAO"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = String((gate.session.user as any)?.role ?? "");

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const existing = await prisma.order.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (role === "VENDEDOR" && String((existing as any).createdById ?? "") !== String(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const data: any = {};

  // ====== Atualização de status (ADMIN ou PRODUCAO) ======
  const newStatus = body?.status ? String(body.status).toUpperCase() : null;
  if (newStatus && ["IN_PRODUCTION", "READY", "DELIVERED"].includes(newStatus)) {
    if (role !== "ADMIN" && role !== "PRODUCAO") {
      return NextResponse.json({ error: "forbidden", message: "Apenas Admin ou Produção podem alterar este status." }, { status: 403 });
    }
    const current = String((existing as any).status ?? "");
    const allowed = ALLOWED_STATUS_TRANSITIONS[current];
    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: "invalid_status_transition", message: `Transição de ${current} para ${newStatus} não permitida.` },
        { status: 400 },
      );
    }
    data.status = newStatus;
  }

  if (body?.clientId != null) data.clientId = String(body.clientId).trim();
  if (body?.notes != null) data.notes = String(body.notes).trim() || null;
  if (body?.notes != null && String(body.notes).trim().length > 500) {
    return NextResponse.json({ error: "notes_too_long", message: "Observação da nota deve ter no máximo 500 caracteres." }, { status: 400 });
  }
  if (body?.paymentNote != null && String(body.paymentNote).trim().length > 500) {
    return NextResponse.json({ error: "payment_note_too_long", message: "Observação de pagamento deve ter no máximo 500 caracteres." }, { status: 400 });
  }

  // ====== PDV intent (VENDEDOR preenche, CAIXA/ADMIN pode ajustar) ======
  if (String((existing as any).status) === "DRAFT") {
    if (body?.requestedDocType != null) data.requestedDocType = String(body.requestedDocType).trim().toUpperCase();
    if (body?.paymentMethod != null) data.paymentMethod = String(body.paymentMethod).trim().toUpperCase();
    if (body?.cardBrand != null) data.cardBrand = String(body.cardBrand).trim().toUpperCase();
    if (body?.installments != null) {
      const k = Number(body.installments);
      data.installments = Number.isFinite(k) ? Math.max(1, Math.min(24, Math.trunc(k))) : null;
    }
    if (body?.dueDays != null) {
      const d = Number(body.dueDays);
      data.dueDays = Number.isFinite(d) && d >= 0 ? Math.min(365, Math.trunc(d)) : null;
    }
    if (body?.intervalDays != null) {
      const i = Number(body.intervalDays);
      data.intervalDays = Number.isFinite(i) && i > 0 ? Math.min(365, Math.trunc(i)) : null;
    }
    if (body?.paymentNote != null) data.paymentNote = String(body.paymentNote).trim() || null;
  } else {
    if (body?.requestedDocType != null || body?.paymentMethod != null || body?.cardBrand != null || body?.installments != null || body?.dueDays != null || body?.intervalDays != null || body?.paymentNote != null || body?.sendToCashier != null) {
      if (body?.sendToCashier !== true) {
        return NextResponse.json({ error: "order_not_draft" }, { status: 400 });
      }
    }
  }

  const alreadySent = Boolean((existing as any).sentToCashierAt);
  if (role === "VENDEDOR" && alreadySent && body?.sendToCashier) {
    return NextResponse.json({ error: "already_sent_to_cashier" }, { status: 400 });
  }
  if (body?.sendToCashier === true) {
    const discountPercent = Number((existing as any).discountPercent ?? 0);
    if (discountPercent > 5) {
      const approved = await prisma.orderDiscountApprovalRequest.findFirst({
        where: { orderId: id, companyId, status: "APPROVED" as any } as any,
        orderBy: { updatedAt: "desc" } as any,
        select: { approvedPercent: true } as any,
      } as any);
      const limit = Number(approved?.approvedPercent ?? 0);
      if (!approved || limit < discountPercent) {
        return NextResponse.json({
          error: "discount_approval_required",
          message: "Desconto acima de 5% precisa ser aprovado pelo admin antes de enviar ao caixa.",
        }, { status: 403 });
      }
    }
    data.sentToCashierAt = new Date();
    data.status = "OPEN";
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id } as any,
      data,
    } as any);
    if (newStatus) {
      await tx.orderStatusHistory.create({
        data: { orderId: id, status: newStatus as any, createdBy: userId } as any,
      } as any);
    }
  });

  return NextResponse.json({ ok: true });
}
