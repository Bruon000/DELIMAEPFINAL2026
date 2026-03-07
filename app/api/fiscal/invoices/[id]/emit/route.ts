import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFiscalProvider } from "@/lib/fiscal-provider";

function requireRole(role: string | undefined, allowed: string[]) {
  return role && allowed.includes(role);
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

  // ===== valida emitente mínimo (para emissor real) =====
  // (não bloqueia MDFE/CTE por enquanto; foco em NFE/NFCE)
  const docType = String(inv.docType ?? "").toUpperCase();
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

  const provider = await getFiscalProvider(companyId);
  let result;
  try {
    result = await provider.emit({ companyId, invoiceId: id, docType: inv.docType as any });
  } catch (e: any) {
    const msg = e?.message ?? "emit_failed";
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
