import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function POST(req: Request) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const body = await req.json().catch(() => null);

  const invoiceId = String(body?.invoiceId ?? "").trim();
  const reason = String(body?.reason ?? "").trim();

  if (!invoiceId) {
    return NextResponse.json({ error: "missing_invoiceId" }, { status: 400 });
  }
  if (reason.length < 15) {
    return NextResponse.json({ error: "reason_too_short", message: "Justificativa deve ter ao menos 15 caracteres." }, { status: 400 });
  }

  const invoice = await prisma.fiscalInvoice.findFirst({
    where: { id: invoiceId, companyId } as any,
    select: { id: true, docType: true, serie: true, number: true, status: true, inutilizedAt: true } as any,
  } as any);

  if (!invoice) {
    return NextResponse.json({ error: "invoice_not_found" }, { status: 404 });
  }

  if ((invoice as any).inutilizedAt) {
    return NextResponse.json({ error: "already_inutilized" }, { status: 409 });
  }

  const status = String((invoice as any).status).toUpperCase();
  if (status === "AUTHORIZED") {
    return NextResponse.json({ error: "cannot_inutilize_authorized", message: "Nota autorizada não pode ser inutilizada. Use cancelamento." }, { status: 409 });
  }

  const serie = Number((invoice as any).serie ?? 1);
  const number = Number(String((invoice as any).number ?? "0").replace(/\D/g, ""));

  if (!number) {
    return NextResponse.json({ error: "no_number", message: "Nota sem número atribuído, não precisa inutilizar." }, { status: 400 });
  }

  const record = await prisma.fiscalInutilization.create({
    data: {
      companyId,
      docType: String((invoice as any).docType),
      serie,
      numberStart: number,
      numberEnd: number,
      reason,
      status: "SUCCESS",
      requestedById: userId,
    } as any,
    select: { id: true } as any,
  } as any);

  await prisma.fiscalInvoice.update({
    where: { id: invoiceId } as any,
    data: { inutilizedAt: new Date(), status: "INUTILIZED" } as any,
  } as any);

  return NextResponse.json({ ok: true, inutilizationId: record.id });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(req: Request) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;

  const pending = await prisma.fiscalInvoice.findMany({
    where: {
      companyId,
      status: { in: ["REJECTED", "DENIED"] } as any,
      number: { not: null } as any,
      inutilizedAt: null,
    } as any,
    select: {
      id: true, docType: true, model: true, serie: true,
      number: true, status: true, key: true, createdAt: true, orderId: true,
    } as any,
    orderBy: { createdAt: "desc" } as any,
    take: 50,
  } as any);

  return NextResponse.json({ pending });
}
