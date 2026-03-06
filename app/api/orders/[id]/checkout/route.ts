import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const id = ctx.params.id;
  const body = (await req.json().catch(() => null)) as any;

  const order = await prisma.order.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  const requestedDocType = body?.requestedDocType ? String(body.requestedDocType).toUpperCase() : null;
  const paymentMethod = body?.paymentMethod ? String(body.paymentMethod).toUpperCase() : null;
  const cardBrand = body?.cardBrand ? String(body.cardBrand).toUpperCase() : null;
  const installments = body?.installments != null ? Number(body.installments) : null;
  const paymentNote = body?.paymentNote ? String(body.paymentNote).trim() : null;

  const updated = await prisma.order.update({
    where: { id } as any,
    data: {
      requestedDocType,
      paymentMethod,
      cardBrand,
      installments: Number.isFinite(installments) ? installments : null,
      paymentNote: paymentNote || null,
    } as any,
    select: { id: true, requestedDocType: true, paymentMethod: true, cardBrand: true, installments: true, paymentNote: true } as any,
  } as any);

  return NextResponse.json({ ok: true, order: updated });
}
