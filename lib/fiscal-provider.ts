import { prisma } from "@/lib/prisma";

export type FiscalDocType = "NFE" | "NFCE" | "CTE" | "MDFE" | "NFSE";

export type ProviderEmitResult = {
  externalId: string;
  status: "PENDING" | "AUTHORIZED" | "REJECTED";
  model?: number; // 55/65 quando aplicável
  serie?: number;
  number?: string;
  key?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  raw?: any;
};

export type ProviderConsultResult = {
  status: string;
  externalId?: string;
  key?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  issuedAt?: string;
  raw?: any;
};

export type ProviderCancelResult = {
  status: "CANCELLED" | string;
  cancelledAt?: string;
  raw?: any;
};

export type FiscalProvider = {
  emit: (args: { companyId: string; invoiceId: string; docType: FiscalDocType }) => Promise<ProviderEmitResult>;
  cancel: (args: { companyId: string; invoiceId: string; reason: string }) => Promise<ProviderCancelResult>;
  consult: (args: { companyId: string; invoiceId: string }) => Promise<ProviderConsultResult>;
};

function mockId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

/**
 * Provider MOCK: serve para validar fluxo/UI sem SEFAZ.
 * Depois você troca por Nuvem Fiscal (ou outro) sem mexer no resto.
 */
export const mockProvider: FiscalProvider = {
  async emit(args) {
    const { invoiceId, docType } = args;
    const externalId = mockId(docType.toLowerCase());
    const model = docType === "NFCE" ? 65 : docType === "NFE" ? 55 : undefined;

    // Mantém como PENDING (assíncrono), simulando emissor real
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

function notConfiguredProvider(providerName: string): FiscalProvider {
  const err = () => {
    const e = new Error(`fiscal_provider_not_configured:${providerName}`);
    (e as any).code = "fiscal_provider_not_configured";
    return e;
  };
  return {
    async emit() {
      throw err();
    },
    async cancel() {
      throw err();
    },
    async consult() {
      throw err();
    },
  };
}

/**
 * Escolhe provider por empresa.
 * - MOCK: sempre disponível
 * - NUVEMFISCAL/TECNOSPEED/FOCUSNFE: exige token configurado
 */
export async function getFiscalProvider(companyId: string): Promise<FiscalProvider> {
  const cfg = await prisma.fiscalConfig.findUnique({ where: { companyId } });
  const provider = String(cfg?.provider ?? "MOCK").toUpperCase();
  const token = String(cfg?.providerToken ?? "").trim();

  if (provider === "MOCK" || !provider) return mockProvider;

  if (!token) return notConfiguredProvider(provider);

  // Placeholder: aqui entra a implementação real no futuro.
  // Por enquanto, mantém erro claro (mas já deixa o switch pronto).
  return notConfiguredProvider(provider);
}

