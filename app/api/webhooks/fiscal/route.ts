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
  const sourceKind = source === "manual_refresh" || source === "fiscal_stub" ? "stub" : "provider";
  const sig = String(req.headers.get("x-webhook-secret") ?? "").trim();

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

  // valida secret apenas quando webhook for de provider real
  if (sourceKind === "provider") {
    const invoiceRef = invoiceId
      ? await prisma.fiscalInvoice.findFirst({
          where: { id: invoiceId } as any,
          select: { companyId: true } as any,
        } as any)
      : await prisma.fiscalInvoice.findFirst({
          where: { externalId } as any,
          select: { companyId: true } as any,
        } as any);

    const cfg = invoiceRef?.companyId
      ? await prisma.fiscalConfig.findUnique({
          where: { companyId: invoiceRef.companyId } as any,
          select: { webhookSecret: true } as any,
        } as any)
      : null;

    const expected = String(cfg?.webhookSecret ?? "").trim();
    if (!expected || sig !== expected) {
      await prisma.webhookLog.create({
        data: { source, payload: body ?? {}, status: 401 } as any,
      } as any);
      return NextResponse.json({ error: "invalid_webhook_signature" }, { status: 401 });
    }
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
          sourceKind,
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
