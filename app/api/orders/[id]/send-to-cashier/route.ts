import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function s(v: any) {
  const x = String(v ?? "").trim();
  return x.length ? x : null;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = gate.session.user!.role as string;
  const orderId = String(ctx.params.id);

  const body = await req.json().catch(() => ({}));
  const requestedDocType = s(body?.requestedDocType)?.toUpperCase() ?? null; // NFCE|NFE
  const paymentMethod = s(body?.paymentMethod)?.toUpperCase() ?? null;
  const cardBrand = s(body?.cardBrand)?.toUpperCase() ?? null;
  const installments = body?.installments != null ? Number(body.installments) : null;
  const paymentNote = s(body?.paymentNote);

  if (!requestedDocType || !["NFCE", "NFE"].includes(requestedDocType)) {
    return NextResponse.json(
      { error: "invalid_requestedDocType", message: "requestedDocType deve ser NFCE ou NFE" },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId, deletedAt: null } as any,
    select: {
      id: true,
      status: true,
      createdById: true,
      sentToCashierAt: true,
    } as any,
  } as any);

  if (!order?.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (role === "VENDEDOR" && order.createdById && String(order.createdById) !== String(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (order.status !== ("DRAFT" as any)) {
    return NextResponse.json(
      { error: "invalid_status", message: "Somente pedido DRAFT pode ser enviado ao caixa." },
      { status: 409 }
    );
  }

  if (order.sentToCashierAt) {
    return NextResponse.json(
      { error: "already_sent_to_cashier", message: "Pedido já foi enviado ao caixa." },
      { status: 409 }
    );
  }

  const updated = await prisma.order.update({
    where: { id: orderId } as any,
    data: {
      sentToCashierAt: new Date(),
      requestedDocType: requestedDocType as any,
      paymentMethod: paymentMethod || null,
      cardBrand: cardBrand || null,
      installments: Number.isFinite(installments) ? installments : null,
      paymentNote: paymentNote || null,
    } as any,
    select: {
      id: true,
      sentToCashierAt: true,
      status: true,
      requestedDocType: true,
      paymentMethod: true,
      cardBrand: true,
      installments: true,
      paymentNote: true,
    } as any,
  } as any);

  return NextResponse.json({ ok: true, order: updated }, { status: 200 });
}
