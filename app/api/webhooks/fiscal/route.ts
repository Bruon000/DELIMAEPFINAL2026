import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // payload aceito:
  // {
  //   source?: "manual" | "provider",
  //   invoiceId?: string,
  //   externalId?: string,
  //   status?: "AUTHORIZED" | "REJECTED" | "CANCELLED" | "PENDING",
  //   key?: string,
  //   xmlUrl?: string,
  //   pdfUrl?: string,
  //   issuedAt?: string,
  //   raw?: any
  // }

  const source = String(body?.source ?? "fiscal_stub");
  const invoiceId = String(body?.invoiceId ?? "").trim();
  const externalId = String(body?.externalId ?? "").trim();
  const nextStatus = String(body?.status ?? "").trim().toUpperCase();
  const key = String(body?.key ?? "").trim() || null;
  const xmlUrl = String(body?.xmlUrl ?? "").trim() || null;
  const pdfUrl = String(body?.pdfUrl ?? "").trim() || null;
  const issuedAtRaw = String(body?.issuedAt ?? "").trim();
  const issuedAt = issuedAtRaw ? new Date(issuedAtRaw) : null;

  if (!invoiceId && !externalId) {
    return NextResponse.json(
      { error: "missing_invoice_reference", message: "Envie invoiceId ou externalId." },
      { status: 400 },
    );
  }

  const log = await prisma.webhookLog.create({
    data: {
      source,
      payload: body ?? {},
      status: 200,
    } as any,
    select: { id: true, createdAt: true } as any,
  } as any);

  const invoice = await prisma.fiscalInvoice.findFirst({
    where: invoiceId
      ? ({ id: invoiceId } as any)
      : ({ externalId } as any),
    select: {
      id: true,
      status: true,
      externalId: true,
      key: true,
      pdfUrl: true,
      xmlUrl: true,
      issuedAt: true,
      payload: true,
    } as any,
  } as any);

  if (!invoice?.id) {
    return NextResponse.json(
      { ok: false, error: "invoice_not_found", webhookLogId: log.id },
      { status: 404 },
    );
  }

  const updated = await prisma.fiscalInvoice.update({
    where: { id: invoice.id } as any,
    data: {
      status: nextStatus || invoice.status,
      key: key ?? invoice.key,
      xmlUrl: xmlUrl ?? invoice.xmlUrl,
      pdfUrl: pdfUrl ?? invoice.pdfUrl,
      issuedAt: issuedAt ?? invoice.issuedAt,
      payload: {
        ...(typeof invoice.payload === "object" && invoice.payload !== null ? invoice.payload : {}),
        webhookLastUpdate: {
          source,
          receivedAt: new Date().toISOString(),
          status: nextStatus || invoice.status,
          raw: body?.raw ?? body ?? null,
        },
      },
    } as any,
    select: {
      id: true,
      status: true,
      externalId: true,
      key: true,
      xmlUrl: true,
      pdfUrl: true,
      issuedAt: true,
    } as any,
  } as any);

  return NextResponse.json({
    ok: true,
    webhookLogId: log.id,
    invoice: updated,
  });
}
