import { prisma } from "@/lib/prisma";
import type { FiscalProvider } from "@/lib/fiscal/types";

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
        status: "PENDING",
        model: model ?? null,
        payload: {
          ...((await prisma.fiscalInvoice.findUnique({ where: { id: invoiceId }, select: { payload: true } }))?.payload as object),
          provider: { name: "mock", externalId, docType, at: new Date().toISOString() },
        },
      },
    });

    return { externalId, status: "PENDING", model, raw: { mocked: true } };
  },

  async cancel({ invoiceId, reason }) {
    await prisma.fiscalInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "CANCELLED",
        payload: {
          ...((await prisma.fiscalInvoice.findUnique({ where: { id: invoiceId }, select: { payload: true } }))?.payload as object),
          cancel: { reason, at: new Date().toISOString() },
        },
      },
    });
    return { status: "CANCELLED", raw: { mocked: true } };
  },

  async consult({ invoiceId }) {
    const inv = await prisma.fiscalInvoice.findUnique({ where: { id: invoiceId } });
    return {
      status: inv?.status ?? "UNKNOWN",
      externalId: inv?.externalId ?? undefined,
      key: inv?.key ?? undefined,
      pdfUrl: inv?.pdfUrl ?? undefined,
      xmlUrl: inv?.xmlUrl ?? undefined,
      issuedAt: inv?.issuedAt ? inv.issuedAt.toISOString() : undefined,
      raw: inv?.payload ?? null,
    };
  },
};
