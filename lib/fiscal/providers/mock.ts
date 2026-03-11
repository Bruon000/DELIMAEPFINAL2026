import { prisma } from "@/lib/prisma";
import type { FiscalProvider, ProviderCancelResult, ProviderConsultResult } from "@/lib/fiscal/types";

function mockId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

export const mockProvider: FiscalProvider = {
  async emit(args) {
    const { invoiceId, docType } = args;
    const externalId = mockId(docType.toLowerCase());
    const model = docType === "NFCE" ? 65 : docType === "NFE" ? 55 : undefined;

    await prisma.fiscalInvoice.update({
      where: { id: invoiceId },
      data: {
        externalId,
        status: "AUTHORIZED",
        model: model ?? null,
        payload: {
          ...((await prisma.fiscalInvoice.findUnique({ where: { id: invoiceId }, select: { payload: true } }))?.payload as object),
          provider: { name: "mock", externalId, docType, at: new Date().toISOString() },
        },
      },
    });

    return { externalId, status: "AUTHORIZED", model, raw: { mocked: true } };
  },

  async cancel(args): Promise<ProviderCancelResult> {
    return {
      ok: true,
      provider: "MOCK",
      externalId: args.externalId || "mock-id",
      status: "CANCELLED",
      key: null,
      protocol: null,
      statusCode: 135,
      statusReason: "Evento registrado e vinculado à NF-e",
      raw: {},
    };
  },

  async consult({ invoiceId }): Promise<ProviderConsultResult> {
    const inv = await prisma.fiscalInvoice.findUnique({ where: { id: invoiceId } });
    const status = (inv?.status ?? "PENDING") as ProviderConsultResult["status"];
    return {
      ok: true,
      provider: "MOCK",
      externalId: inv?.externalId ?? "",
      status: ["PENDING", "AUTHORIZED", "REJECTED", "CANCELLED", "ERROR"].includes(status) ? status : "PENDING",
      key: inv?.key ?? null,
      protocol: null,
      receipt: null,
      statusCode: null,
      statusReason: null,
      xmlUrl: inv?.xmlUrl ?? null,
      pdfUrl: inv?.pdfUrl ?? null,
      raw: inv?.payload ?? null,
    };
  },

  async download(args) {
    return {
      ok: true,
      provider: "MOCK",
      externalId: args.externalId || "mock-id",
      xmlProc: {
        content: "<nfeProc></nfeProc>",
        mimeType: "application/xml",
        sizeBytes: 19,
      },
      pdf: null,
      raw: {},
    };
  },
};
