export type FiscalDocType = "NFE" | "NFCE" | "CTE" | "MDFE" | "NFSE";

export type ProviderEmitResult = {
  externalId: string;
  status: "PENDING" | "AUTHORIZED" | "REJECTED";
  model?: number;
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
