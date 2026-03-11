import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { getFiscalProvider } from "@/lib/fiscal-provider";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const id = String(params.id || "");
  const body = (await req.json().catch(() => ({}))) as { reason?: string };

  const invoice = await prisma.fiscalInvoice.findFirst({
    where: { id, companyId } as any,
    select: {
      id: true,
      docType: true,
      status: true,
      externalId: true,
    } as any,
  } as any);

  if (!invoice) {
    return NextResponse.json(
      { error: "not_found", message: "Documento fiscal não encontrado." },
      { status: 404 }
    );
  }

  const docType = String(invoice.docType ?? "").toUpperCase();
  if (!["NFE", "NFCE"].includes(docType)) {
    return NextResponse.json(
      { error: "unsupported_doc_type", message: "O cancelamento no provider está implementado apenas para NF-e/NFC-e." },
      { status: 409 }
    );
  }

  if (String(invoice.status ?? "").toUpperCase() !== "AUTHORIZED") {
    return NextResponse.json(
      { error: "invoice_not_authorized", message: "Somente documento autorizado pode ser cancelado." },
      { status: 409 }
    );
  }

  const provider = await getFiscalProvider(companyId);

  try {
    const result = await provider.cancel({
      companyId,
      invoiceId: id,
      externalId: String((invoice as any).externalId ?? ""),
      reason: String(body?.reason ?? ""),
    });

    return NextResponse.json({
      ok: true,
      invoiceId: id,
      result,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Falha ao cancelar a NF-e no provider.";
    return NextResponse.json(
      {
        ok: false,
        error: "provider_cancel_failed",
        message,
      },
      { status: 400 }
    );
  }
}
