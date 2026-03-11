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
  ok: boolean;
  provider: string;
  externalId: string;
  status: "PENDING" | "AUTHORIZED" | "REJECTED" | "CANCELLED" | "ERROR";
  key?: string | null;
  protocol?: string | null;
  receipt?: string | null;
  statusCode?: number | null;
  statusReason?: string | null;
  xmlUrl?: string | null;
  pdfUrl?: string | null;
  raw: unknown;
};

export type ProviderDownloadResult = {
  ok: boolean;
  provider: string;
  externalId: string;
  xmlProc?: {
    content: string;
    mimeType: string;
    sizeBytes: number;
  } | null;
  pdf?: {
    contentBase64: string;
    mimeType: string;
    sizeBytes: number;
  } | null;
  raw?: unknown;
};

export type ProviderCancelResult = {
  ok: boolean;
  provider: string;
  externalId: string;
  status: "PENDING" | "AUTHORIZED" | "REJECTED" | "CANCELLED" | "ERROR";
  key?: string | null;
  protocol?: string | null;
  statusCode?: number | null;
  statusReason?: string | null;
  raw: unknown;
};

/** Payload opcional para emissão (ex.: Nuvem Fiscal: infNFe / infNFeSupl) */
export type FiscalEmitPayload = {
  reference?: string | null;
  infNFe?: Record<string, unknown>;
  infNFeSupl?: Record<string, unknown> | null;
};

export type FiscalProvider = {
  emit: (args: {
    companyId: string;
    invoiceId: string;
    docType: FiscalDocType;
    payload?: FiscalEmitPayload;
  }) => Promise<ProviderEmitResult>;
  cancel: (args: { companyId: string; invoiceId: string; externalId?: string; reason?: string }) => Promise<ProviderCancelResult>;
  consult: (args: { companyId: string; invoiceId: string; externalId?: string }) => Promise<ProviderConsultResult>;
  download: (args: { companyId: string; invoiceId: string; externalId?: string }) => Promise<ProviderDownloadResult>;
};
