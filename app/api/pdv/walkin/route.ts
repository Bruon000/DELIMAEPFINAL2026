import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

// PDV: cria um pedido DRAFT para "CONSUMIDOR FINAL (BALCÃO)" e já envia ao caixa.
// Regra: NFCE por padrão (cliente sem documento).
export async function POST(req: Request) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;

  const body = await req.json().catch(() => null);
  const paymentMethod = body?.paymentMethod ? String(body.paymentMethod).toUpperCase() : null;
  const cardBrand = body?.cardBrand ? String(body.cardBrand).toUpperCase() : null;
  const installments = body?.installments != null ? Number(body.installments) : null;
  const paymentNote = body?.paymentNote ? String(body.paymentNote).trim() : null;

  // garante cliente WALKIN
  const walkin = await prisma.client.findFirst({
    where: { companyId, document: "WALKIN", deletedAt: null } as any,
    select: { id: true } as any,
  } as any);

  if (!walkin?.id) {
    return NextResponse.json({ error: "walkin_not_found", message: "Cliente balcão (WALKIN) não existe. Rode o seed." }, { status: 404 });
  }

  const order = await prisma.order.create({
    data: {
      id: `ord_${Date.now()}`,
      companyId,
      createdById: userId,
      clientId: String(walkin.id),
      status: "DRAFT" as any,
      sentToCashierAt: new Date(),
      requestedDocType: "NFCE" as any,
      paymentMethod: paymentMethod || null,
      cardBrand: cardBrand || null,
      installments: Number.isFinite(installments) ? installments : null,
      paymentNote: paymentNote || null,
    } as any,
    select: { id: true } as any,
  } as any);

  return NextResponse.json({ ok: true, id: order.id }, { status: 201 });
}
