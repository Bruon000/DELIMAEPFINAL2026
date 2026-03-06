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
      client: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  } as any);

  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (role === "VENDEDOR" && String((order as any).createdById ?? "") !== String(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
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
  if (body?.clientId != null) data.clientId = String(body.clientId).trim();
  if (body?.notes != null) data.notes = String(body.notes).trim() || null;

  // ====== PDV intent (VENDEDOR preenche, CAIXA/ADMIN pode ajustar) ======
  // Só faz sentido enquanto está em DRAFT
  if (String((existing as any).status) !== "DRAFT") {
    // ainda permite notes/clientId para ADMIN, mas trava intenção do PDV fora do DRAFT
    if (body?.requestedDocType != null || body?.paymentMethod != null || body?.cardBrand != null || body?.installments != null || body?.paymentNote != null || body?.sendToCashier != null) {
      return NextResponse.json({ error: "order_not_draft" }, { status: 400 });
    }
  }

  // VENDEDOR não pode re-enviar depois de já enviado
  const alreadySent = Boolean((existing as any).sentToCashierAt);
  if (role === "VENDEDOR" && alreadySent && body?.sendToCashier) {
    return NextResponse.json({ error: "already_sent_to_cashier" }, { status: 400 });
  }

  // Campos de intenção (opcionais)
  if (body?.requestedDocType != null) data.requestedDocType = String(body.requestedDocType).trim().toUpperCase();
  if (body?.paymentMethod != null) data.paymentMethod = String(body.paymentMethod).trim().toUpperCase();
  if (body?.cardBrand != null) data.cardBrand = String(body.cardBrand).trim().toUpperCase();
  if (body?.installments != null) {
    const k = Number(body.installments);
    data.installments = Number.isFinite(k) ? Math.max(1, Math.min(24, Math.trunc(k))) : null;
  }
  if (body?.paymentNote != null) data.paymentNote = String(body.paymentNote).trim() || null;

  // Enviar ao caixa (marca timestamp)
  if (body?.sendToCashier === true) {
    data.sentToCashierAt = new Date();
  }

  await prisma.order.update({
    where: { id } as any,
    data,
  } as any);

  return NextResponse.json({ ok: true });
}
