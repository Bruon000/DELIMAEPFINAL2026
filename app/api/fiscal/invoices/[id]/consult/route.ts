import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getFiscalProvider } from "@/lib/fiscal-provider";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const id = String(params.id || "");

  const invoice = await prisma.fiscalInvoice.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      externalId: true,
      docType: true,
      status: true,
    },
  });

  if (!invoice) {
    return NextResponse.json(
      { error: "not_found", message: "Documento fiscal não encontrado." },
      { status: 404 }
    );
  }

  const docType = String(invoice.docType ?? "").toUpperCase();
  if (!["NFE", "NFCE"].includes(docType)) {
    return NextResponse.json(
      { error: "unsupported_doc_type", message: "A consulta do provider está implementada apenas para NF-e/NFC-e." },
      { status: 409 }
    );
  }

  const provider = await getFiscalProvider(companyId);

  try {
    const result = await provider.consult({
      companyId,
      invoiceId: id,
      externalId: invoice.externalId ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      invoiceId: id,
      result,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Falha ao consultar a NF-e no provider.";
    return NextResponse.json(
      {
        ok: false,
        error: "provider_consult_failed",
        message,
      },
      { status: 400 }
    );
  }
}
