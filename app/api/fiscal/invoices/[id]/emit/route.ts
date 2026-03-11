import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFiscalProvider } from "@/lib/fiscal-provider";

function requireRole(role: string | undefined, allowed: string[]) {
  return role && allowed.includes(role);
}

function onlyDigits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!requireRole((session.user as { role?: string }).role, ["ADMIN", "CAIXA"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const id = ctx.params.id;

  const inv = await prisma.fiscalInvoice.findFirst({ where: { id, companyId } });
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const payload = (typeof inv.payload === "object" && inv.payload !== null ? inv.payload : {}) as any;
  const client = payload?.client ?? null;
  const items = Array.isArray(payload?.items) ? payload.items : [];

  const docDigits = onlyDigits(client?.document);
  const isWalkin = String(client?.document ?? "").trim().toUpperCase() === "WALKIN";
  const isCpf = docDigits.length === 11;
  const isCnpjDest = docDigits.length === 14;
  const docType = String(inv.docType ?? "").toUpperCase();

  const missingRecipient: string[] = [];

  if (docType === "NFE") {
    if (!String(client?.name ?? "").trim()) missingRecipient.push("client.name");
    if (!String(client?.document ?? "").trim()) missingRecipient.push("client.document");

    if (isWalkin) {
      missingRecipient.push("client.document");
    }

    if (isCnpjDest) {
      if (!String(client?.address?.street ?? "").trim()) missingRecipient.push("client.address.street");
      if (!String(client?.address?.number ?? "").trim()) missingRecipient.push("client.address.number");
      if (!String(client?.address?.district ?? "").trim()) missingRecipient.push("client.address.district");
      if (!String(client?.address?.city ?? "").trim()) missingRecipient.push("client.address.city");
      if (!String(client?.address?.state ?? "").trim()) missingRecipient.push("client.address.state");
    }
  }

  if (docType === "NFCE") {
    if (!String(client?.name ?? "").trim()) missingRecipient.push("client.name");
    if (!isWalkin && !String(client?.document ?? "").trim()) missingRecipient.push("client.document_or_walkin");
  }

  if (missingRecipient.length) {
    return NextResponse.json(
      {
        error: "destinatario_incompleto",
        message: "Revise os dados do destinatário antes de emitir.",
        docType,
        isCpf,
        isCnpj: isCnpjDest,
        isWalkin,
        missing: missingRecipient,
      },
      { status: 409 },
    );
  }

  // ===== valida emitente mínimo (para emissor real) =====
  // (não bloqueia MDFE/CTE por enquanto; foco em NFE/NFCE)
  if (docType === "NFE" || docType === "NFCE") {
    const company = await prisma.company.findUnique({
      where: { id: companyId } as any,
      select: { document: true } as any,
    } as any);
    const f = await prisma.companyFiscal.findUnique({
      where: { companyId } as any,
      select: {
        legalName: true,
        tradeName: true,
        ie: true,
        crt: true,
        addressStreet: true,
        addressNumber: true,
        addressDistrict: true,
        addressCity: true,
        addressState: true,
        addressZip: true,
        cityCodeIbge: true,
      } as any,
    } as any);

    const missing: string[] = [];
    if (!company?.document) missing.push("company.document(CNPJ)");
    if (!f?.legalName) missing.push("companyFiscal.legalName(razao social)");
    if (!f?.tradeName) missing.push("companyFiscal.tradeName(nome fantasia)");
    if (!f?.ie) missing.push("companyFiscal.ie(IE)");
    if (!f?.crt) missing.push("companyFiscal.crt(CRT)");
    if (!f?.addressStreet) missing.push("companyFiscal.addressStreet");
    if (!f?.addressNumber) missing.push("companyFiscal.addressNumber");
    if (!f?.addressDistrict) missing.push("companyFiscal.addressDistrict");
    if (!f?.addressCity) missing.push("companyFiscal.addressCity");
    if (!f?.addressState) missing.push("companyFiscal.addressState(UF)");
    if (!f?.addressZip) missing.push("companyFiscal.addressZip(CEP)");
    if (!f?.cityCodeIbge) missing.push("companyFiscal.cityCodeIbge(cMun IBGE)");

    if (missing.length) {
      return NextResponse.json(
        {
          error: "emitente_incompleto",
          message: "Complete os dados fiscais do emitente antes de emitir.",
          missing,
        },
        { status: 409 },
      );
    }
  }

  const missingItems: Array<{ index: number; name: string; missing: string[] }> = [];
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i] ?? {};
    const f = it?.fiscal ?? null;
    const missing: string[] = [];
    if (!f) {
      missing.push("product.fiscal");
    } else {
      if (f.origin == null || !Number.isFinite(Number(f.origin))) missing.push("product.fiscal.origin");
      if (!String(f.ncm ?? "").trim()) missing.push("product.fiscal.ncm");
      if (!String(f.cfop ?? "").trim()) missing.push("product.fiscal.cfop");
      if (!String(f.cst ?? "").trim() && !String(f.csosn ?? "").trim()) missing.push("product.fiscal.cst_or_csosn");
    }
    if (missing.length) {
      missingItems.push({ index: i + 1, name: String(it?.name ?? `Item ${i + 1}`), missing });
    }
  }
  if (missingItems.length) {
    return NextResponse.json(
      {
        error: "itens_fiscais_incompletos",
        message: "Existem itens sem base fiscal suficiente para emitir.",
        missingItems,
      },
      { status: 409 },
    );
  }

  if (inv.docType === "NFE" && !(payload?.infNFe != null && typeof payload.infNFe === "object")) {
    return NextResponse.json(
      {
        error: "missing_nuvemfiscal_payload",
        message: "A invoice não possui infNFe pronto para envio ao provider.",
      },
      { status: 409 },
    );
  }

  const provider = await getFiscalProvider(companyId);
  const invPayload = typeof inv.payload === "object" && inv.payload !== null ? (inv.payload as Record<string, unknown>) : {};
  const providerPayload =
    inv.docType === "NFE" && invPayload.infNFe != null
      ? {
          reference: `invoice:${id}`,
          infNFe: invPayload.infNFe as Record<string, unknown>,
          infNFeSupl: (invPayload.infNFeSupl as Record<string, unknown> | null) ?? undefined,
        }
      : undefined;

  let result;
  try {
    result = await provider.emit({
      companyId,
      invoiceId: id,
      docType: inv.docType as "NFE" | "NFCE" | "CTE" | "MDFE" | "NFSE",
      payload: providerPayload,
    });
  } catch (e: unknown) {
    const msg = (e instanceof Error ? e.message : null) ?? "emit_failed";
    if (String(msg).startsWith("fiscal_provider_not_configured:")) {
      return NextResponse.json({ error: "provider_not_configured", message: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "emit_failed", message: msg }, { status: 400 });
  }

  // grava metadados retornados (sem inventar número!)
  const updated = await prisma.fiscalInvoice.update({
    where: { id },
    data: {
      externalId: result.externalId ?? inv.externalId,
      status: result.status,
      model: result.model ?? inv.model,
      serie: result.serie ?? inv.serie,
      number: result.number ?? inv.number,
      key: result.key ?? inv.key,
      pdfUrl: result.pdfUrl ?? inv.pdfUrl,
      xmlUrl: result.xmlUrl ?? inv.xmlUrl,
      payload: {
        ...(typeof inv.payload === "object" && inv.payload !== null ? inv.payload : {}),
        emissionMeta: {
          emittedAt: new Date().toISOString(),
          emittedByUserId: session.user.id,
        },
        providerResult: result.raw ?? null,
      },
    },
    select: {
      id: true,
      status: true,
      externalId: true,
      model: true,
      serie: true,
      number: true,
      key: true,
    },
  });

  return NextResponse.json({ ok: true, invoice: updated });
}
