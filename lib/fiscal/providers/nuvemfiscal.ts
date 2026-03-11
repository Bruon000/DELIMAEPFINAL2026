import { prisma } from "@/lib/prisma";
import type {
  FiscalProvider,
  FiscalEmitPayload,
  ProviderEmitResult,
  ProviderConsultResult,
  ProviderDownloadResult,
  ProviderCancelResult,
} from "@/lib/fiscal/types";
import { buildProviderNotConfiguredError } from "@/lib/fiscal/errors";

type NuvemFiscalSetupResult = {
  ok: boolean;
  companyCnpj: string;
  ambiente: "homologacao" | "producao";
  providerBaseUrl: string;
  company?: unknown;
  certificate?: unknown;
  nfeConfig?: unknown;
  nfceConfig?: unknown;
  sefazNfe?: unknown;
  sefazNfce?: unknown;
};

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function envToNuvemFiscal(value: unknown): "homologacao" | "producao" {
  return String(value ?? "").toUpperCase() === "PROD" ? "producao" : "homologacao";
}

function getBaseUrl(cfg: { providerBaseUrl?: string | null }) {
  return text(cfg?.providerBaseUrl) || "https://api.nuvemfiscal.com.br";
}

function getHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function nfFetchJson<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const raw = await res.text();
  const data = raw ? safeJsonParse(raw) : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data && String((data as { message?: unknown }).message)) ||
      (data && typeof data === "object" && "descricao" in data && String((data as { descricao?: unknown }).descricao)) ||
      raw ||
      fallbackMessage;

    const error = new Error(message) as Error & { status?: number; body?: unknown };
    error.status = res.status;
    error.body = data;
    throw error;
  }

  return data as T;
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function normalizeDocType(docType: unknown): "NFE" | "NFCE" {
  return String(docType ?? "").toUpperCase() === "NFCE" ? "NFCE" : "NFE";
}

function getDocumentEndpoint(docType: unknown) {
  return normalizeDocType(docType) === "NFCE" ? "nfce" : "nfe";
}

function mapNuvemStatusToProvider(status: unknown): "PENDING" | "AUTHORIZED" | "REJECTED" | "CANCELLED" | "ERROR" {
  const s = String(status ?? "").toLowerCase();
  if (["autorizado", "autorizada"].includes(s)) return "AUTHORIZED";
  if (["cancelado", "cancelada"].includes(s)) return "CANCELLED";
  if (["rejeitado", "denegado", "erro"].includes(s)) return "REJECTED";
  if (["pendente", "processando"].includes(s)) return "PENDING";
  return "ERROR";
}

/** Converte status da Nuvem para o retorno de emit (apenas PENDING | AUTHORIZED | REJECTED). */
function mapNuvemStatusToEmit(status: unknown): "PENDING" | "AUTHORIZED" | "REJECTED" {
  const mapped = mapNuvemStatusToProvider(status);
  if (mapped === "AUTHORIZED" || mapped === "REJECTED") return mapped;
  return "PENDING";
}

function extractConsultMeta(result: any) {
  const autorizacao = result?.autorizacao ?? null;
  return {
    key: String(result?.chave ?? autorizacao?.chave_acesso ?? "") || null,
    protocol: String(autorizacao?.numero_protocolo ?? "") || null,
    receipt: String(result?.recibo?.numero ?? "") || null,
    statusCode:
      typeof autorizacao?.codigo_status === "number"
        ? autorizacao.codigo_status
        : typeof result?.codigo_status === "number"
          ? result.codigo_status
          : null,
    statusReason:
      String(autorizacao?.motivo_status ?? result?.motivo_status ?? result?.mensagem ?? "") || null,
    xmlUrl: result?.links?.xml ?? result?.xml_url ?? null,
    pdfUrl: result?.links?.pdf ?? result?.pdf_url ?? null,
  };
}

async function loadCompanyContext(companyId: string) {
  const [company, companyFiscal, config] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        document: true,
        email: true,
        phone: true,
      },
    }),
    prisma.companyFiscal.findUnique({
      where: { companyId },
    }),
    prisma.fiscalConfig.findUnique({
      where: { companyId },
    }),
  ]);

  const cnpj = digits(company?.document);
  const token = text(config?.providerToken);
  const provider = String(config?.provider ?? "").toUpperCase();

  if (provider !== "NUVEMFISCAL") {
    throw buildProviderNotConfiguredError("NUVEMFISCAL");
  }

  if (!cnpj || cnpj.length !== 14) {
    throw new Error("CNPJ da empresa inválido para integrar com a Nuvem Fiscal.");
  }

  if (!token) {
    throw new Error("Token da Nuvem Fiscal não configurado.");
  }

  if (!companyFiscal?.legalName) {
    throw new Error("Razão social do emitente não configurada.");
  }

  if (!companyFiscal?.ie) {
    throw new Error("Inscrição Estadual do emitente não configurada.");
  }

  if (![1, 2, 3].includes(Number(companyFiscal?.crt))) {
    throw new Error("CRT do emitente não configurado.");
  }

  if (!companyFiscal?.addressStreet || !companyFiscal?.addressNumber || !companyFiscal?.addressDistrict) {
    throw new Error("Endereço fiscal do emitente incompleto.");
  }

  if (!companyFiscal?.addressCity || !companyFiscal?.addressState) {
    throw new Error("Cidade/UF do emitente incompletas.");
  }

  if (!digits(companyFiscal?.addressZip) || digits(companyFiscal?.addressZip).length !== 8) {
    throw new Error("CEP fiscal do emitente inválido.");
  }

  if (!digits(companyFiscal?.cityCodeIbge) || digits(companyFiscal?.cityCodeIbge).length !== 7) {
    throw new Error("cMun IBGE do emitente inválido.");
  }

  if (!text(config?.certificatePfxBase64) || !text(config?.certificatePassword)) {
    throw new Error("Certificado A1/PFX não configurado completamente.");
  }

  if (!text(config?.csc) || !digits(config?.cscId)) {
    throw new Error("CSC/ID CSC não configurados.");
  }

  return {
    company,
    companyFiscal,
    config,
    cnpj,
    token,
    ambiente: envToNuvemFiscal(config?.environment),
    baseUrl: getBaseUrl(config ?? {}),
  };
}

async function ensureCompany(baseUrl: string, token: string, ctx: Awaited<ReturnType<typeof loadCompanyContext>>) {
  const existing = await nfFetchJson<{ data?: unknown[]; items?: unknown[] } | unknown[]>(
    `${baseUrl}/empresas?cpf_cnpj=${ctx.cnpj}`,
    { method: "GET", headers: getHeaders(token) },
    "Falha ao consultar empresa na Nuvem Fiscal."
  );

  const hasExisting =
    Array.isArray((existing as { data?: unknown[] })?.data) ? (existing as { data: unknown[] }).data.length > 0 :
    Array.isArray(existing) ? existing.length > 0 :
    Boolean((existing as { items?: unknown[] })?.items?.length);

  if (hasExisting) {
    return existing;
  }

  return await nfFetchJson<unknown>(
    `${baseUrl}/empresas`,
    {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({
        cpf_cnpj: ctx.cnpj,
        inscricao_estadual: text(ctx.companyFiscal?.ie),
        nome_razao_social: text(ctx.companyFiscal?.legalName),
        nome_fantasia: text(ctx.companyFiscal?.tradeName) || undefined,
        email: text(ctx.company?.email) || undefined,
        telefone: text(ctx.company?.phone) || undefined,
        endereco: {
          logradouro: text(ctx.companyFiscal?.addressStreet),
          numero: text(ctx.companyFiscal?.addressNumber),
          bairro: text(ctx.companyFiscal?.addressDistrict),
          municipio: text(ctx.companyFiscal?.addressCity),
          uf: text(ctx.companyFiscal?.addressState),
          cep: digits(ctx.companyFiscal?.addressZip),
          codigo_municipio: digits(ctx.companyFiscal?.cityCodeIbge),
        },
      }),
    },
    "Falha ao cadastrar empresa na Nuvem Fiscal."
  );
}

async function uploadCertificate(baseUrl: string, token: string, ctx: Awaited<ReturnType<typeof loadCompanyContext>>) {
  return await nfFetchJson<unknown>(
    `${baseUrl}/empresas/${ctx.cnpj}/certificado`,
    {
      method: "PUT",
      headers: getHeaders(token),
      body: JSON.stringify({
        certificado: text(ctx.config?.certificatePfxBase64),
        password: text(ctx.config?.certificatePassword),
      }),
    },
    "Falha ao cadastrar certificado na Nuvem Fiscal."
  );
}

async function configureNfe(baseUrl: string, token: string, ctx: Awaited<ReturnType<typeof loadCompanyContext>>) {
  return await nfFetchJson<unknown>(
    `${baseUrl}/empresas/${ctx.cnpj}/nfe`,
    {
      method: "PUT",
      headers: getHeaders(token),
      body: JSON.stringify({
        ambiente: ctx.ambiente,
        CRT: Number(ctx.companyFiscal?.crt),
      }),
    },
    "Falha ao configurar NF-e na Nuvem Fiscal."
  );
}

async function configureNfce(baseUrl: string, token: string, ctx: Awaited<ReturnType<typeof loadCompanyContext>>) {
  return await nfFetchJson<unknown>(
    `${baseUrl}/empresas/${ctx.cnpj}/nfce`,
    {
      method: "PUT",
      headers: getHeaders(token),
      body: JSON.stringify({
        ambiente: ctx.ambiente,
        CRT: Number(ctx.companyFiscal?.crt),
        id_token_csc: Number(digits(ctx.config?.cscId)),
        csc: text(ctx.config?.csc),
      }),
    },
    "Falha ao configurar NFC-e na Nuvem Fiscal."
  );
}

async function sefazStatus(
  baseUrl: string,
  token: string,
  service: "nfe" | "nfce",
  cpfCnpj: string
) {
  return await nfFetchJson<unknown>(
    `${baseUrl}/${service}/sefaz/status?cpf_cnpj=${cpfCnpj}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    `Falha ao consultar status da SEFAZ em ${service.toUpperCase()}.`
  );
}

export async function syncNuvemFiscalSetup(companyId: string): Promise<NuvemFiscalSetupResult> {
  const ctx = await loadCompanyContext(companyId);

  const [companyResult, certificateResult, nfeConfig, nfceConfig, sefazNfe, sefazNfce] =
    await Promise.all([
      ensureCompany(ctx.baseUrl, ctx.token, ctx),
      uploadCertificate(ctx.baseUrl, ctx.token, ctx),
      configureNfe(ctx.baseUrl, ctx.token, ctx),
      configureNfce(ctx.baseUrl, ctx.token, ctx),
      sefazStatus(ctx.baseUrl, ctx.token, "nfe", ctx.cnpj),
      sefazStatus(ctx.baseUrl, ctx.token, "nfce", ctx.cnpj),
    ]);

  return {
    ok: true,
    companyCnpj: ctx.cnpj,
    ambiente: ctx.ambiente,
    providerBaseUrl: ctx.baseUrl,
    company: companyResult,
    certificate: certificateResult,
    nfeConfig,
    nfceConfig,
    sefazNfe,
    sefazNfce,
  };
}

type EmitArgs = {
  companyId: string;
  invoiceId: string;
  docType: "NFE" | "NFCE" | "CTE" | "MDFE" | "NFSE";
  payload?: FiscalEmitPayload;
};

function normalizeEmitPayload(
  args: EmitArgs,
  ambiente: "homologacao" | "producao"
): { docType: string; ambiente: "homologacao" | "producao"; referencia: string; infNFe: Record<string, unknown>; infNFeSupl?: Record<string, unknown> } {
  if (!args.payload?.infNFe) {
    throw new Error("Payload interno sem infNFe para emissão fiscal.");
  }
  return {
    docType: args.docType,
    ambiente,
    referencia: text(args.payload.reference) || `invoice:${args.invoiceId}`,
    infNFe: args.payload.infNFe,
    ...(args.payload.infNFeSupl ? { infNFeSupl: args.payload.infNFeSupl } : {}),
  };
}

async function persistInitialEmitResult(invoiceId: string, result: { id?: unknown; status?: unknown; [k: string]: unknown }) {
  await prisma.fiscalInvoice.update({
    where: { id: invoiceId },
    data: {
      externalId: String(result?.id ?? ""),
      status: String(result?.status ?? "pendente").toUpperCase(),
      payload: { ...(result ?? {}) } as object,
    },
  });
}

async function persistConsultResult(invoiceId: string, result: any) {
  const mappedStatus = mapNuvemStatusToProvider(result?.status);
  const meta = extractConsultMeta(result);

  await prisma.fiscalInvoice.update({
    where: { id: invoiceId },
    data: {
      status: mappedStatus,
      key: meta.key ?? undefined,
      payload: result as object,
    },
  });
}

async function fetchTextOrThrow(url: string, headers: Record<string, string>, fallbackMessage: string) {
  const res = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || fallbackMessage);
  }

  return {
    content: text,
    mimeType: contentType,
    sizeBytes: Buffer.byteLength(text, "utf8"),
  };
}

async function fetchBinaryAsBase64OrThrow(url: string, headers: Record<string, string>, fallbackMessage: string) {
  const res = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "application/pdf";
  const arr = await res.arrayBuffer();

  if (!res.ok) {
    const raw = Buffer.from(arr).toString("utf8");
    throw new Error(raw || fallbackMessage);
  }

  const buf = Buffer.from(arr);
  return {
    contentBase64: buf.toString("base64"),
    mimeType: contentType,
    sizeBytes: buf.byteLength,
  };
}

async function persistDownloadedArtifacts(invoiceId: string, downloaded: {
  xmlProc?: { content: string; mimeType: string; sizeBytes: number } | null;
  pdf?: { contentBase64: string; mimeType: string; sizeBytes: number } | null;
  provider: string;
  externalId: string;
}) {
  const current = await prisma.fiscalInvoice.findUnique({
    where: { id: invoiceId },
    select: { payload: true } as any,
  } as any);

  const currentPayload =
    current && typeof (current as any).payload === "object" && (current as any).payload
      ? ((current as any).payload as Record<string, unknown>)
      : {};

  const nextPayload = {
    ...currentPayload,
    artifacts: {
      ...((currentPayload as any)?.artifacts ?? {}),
      provider: downloaded.provider,
      externalId: downloaded.externalId,
      downloadedAt: new Date().toISOString(),
      ...(downloaded.xmlProc ? { xmlProc: downloaded.xmlProc } : {}),
      ...(downloaded.pdf ? { pdf: downloaded.pdf } : {}),
    },
  };

  await prisma.fiscalInvoice.update({
    where: { id: invoiceId },
    data: {
      payload: nextPayload as any,
    } as any,
  });
}

function extractCancelMeta(result: any) {
  return {
    key: String(result?.chave_acesso ?? result?.chave ?? "") || null,
    protocol: String(result?.numero_protocolo ?? "") || null,
    statusCode:
      typeof result?.codigo_status === "number"
        ? result.codigo_status
        : typeof result?.codigo === "number"
          ? result.codigo
          : null,
    statusReason:
      String(result?.motivo_status ?? result?.motivo ?? result?.mensagem ?? result?.status ?? "") || null,
  };
}

async function persistCancelResult(invoiceId: string, result: any, reason: string) {
  const meta = extractCancelMeta(result);

  const current = await prisma.fiscalInvoice.findUnique({
    where: { id: invoiceId },
    select: { payload: true } as any,
  } as any);

  const currentPayload =
    current && typeof (current as any).payload === "object" && (current as any).payload
      ? ((current as any).payload as Record<string, unknown>)
      : {};

  const nextPayload = {
    ...currentPayload,
    cancelEvent: {
      requestedAt: new Date().toISOString(),
      reason,
      result,
    },
  };

  await prisma.fiscalInvoice.update({
    where: { id: invoiceId },
    data: {
      status: "CANCELLED",
      ...(meta.key != null ? { key: meta.key } : {}),
      payload: nextPayload as any,
    } as any,
  });
}

export const nuvemFiscalProvider: FiscalProvider = {
  async emit(args: EmitArgs): Promise<ProviderEmitResult> {
    const ctx = await loadCompanyContext(args.companyId);

    await ensureCompany(ctx.baseUrl, ctx.token, ctx);
    await uploadCertificate(ctx.baseUrl, ctx.token, ctx);
    if (args.docType === "NFE") {
      await configureNfe(ctx.baseUrl, ctx.token, ctx);
    } else {
      await configureNfce(ctx.baseUrl, ctx.token, ctx);
    }

    const body = normalizeEmitPayload(args, ctx.ambiente);
    const endpoint = args.docType === "NFE" ? "nfe" : "nfce";

    const result = (await nfFetchJson<{ id?: string; status?: string; [k: string]: unknown }>(
      `${ctx.baseUrl}/${endpoint}`,
      {
        method: "POST",
        headers: getHeaders(ctx.token),
        body: JSON.stringify(body),
      },
      `Falha ao emitir ${args.docType === "NFE" ? "NF-e" : "NFC-e"} na Nuvem Fiscal.`
    )) as { id?: string; status?: string; [k: string]: unknown };

    await persistInitialEmitResult(args.invoiceId, result);

    return {
      externalId: String(result?.id ?? ""),
      status: mapNuvemStatusToEmit(result?.status ?? "pendente"),
      raw: result,
    };
  },
  async consult(args): Promise<ProviderConsultResult> {
    const ctx = await loadCompanyContext(args.companyId);

    const invoice = await prisma.fiscalInvoice.findUnique({
      where: { id: args.invoiceId },
      select: {
        id: true,
        externalId: true,
        docType: true,
      } as any,
    } as any);

    const externalId = text(args.externalId) || text((invoice as any)?.externalId);
    if (!externalId) {
      throw new Error("A invoice fiscal não possui externalId para consulta na Nuvem Fiscal.");
    }

    const docType = normalizeDocType((invoice as any)?.docType);
    const endpoint = getDocumentEndpoint(docType);

    const result = await nfFetchJson<any>(
      `${ctx.baseUrl}/${endpoint}/${externalId}`,
      {
        method: "GET",
        headers: getHeaders(ctx.token),
      },
      `Falha ao consultar ${docType === "NFCE" ? "NFC-e" : "NF-e"} na Nuvem Fiscal.`
    );

    await persistConsultResult(args.invoiceId, result);

    const mappedStatus = mapNuvemStatusToProvider(result?.status);
    const meta = extractConsultMeta(result);

    return {
      ok: true,
      provider: "NUVEMFISCAL",
      externalId,
      status: mappedStatus,
      key: meta.key,
      protocol: meta.protocol,
      receipt: meta.receipt,
      statusCode: meta.statusCode,
      statusReason: meta.statusReason,
      xmlUrl: meta.xmlUrl,
      pdfUrl: meta.pdfUrl,
      raw: result,
    };
  },

  async download(args): Promise<ProviderDownloadResult> {
    const ctx = await loadCompanyContext(args.companyId);

    const invoice = await prisma.fiscalInvoice.findUnique({
      where: { id: args.invoiceId },
      select: {
        id: true,
        externalId: true,
        status: true,
        docType: true,
      } as any,
    } as any);

    const externalId = text(args.externalId) || text((invoice as any)?.externalId);
    if (!externalId) {
      throw new Error("A invoice fiscal não possui externalId para download na Nuvem Fiscal.");
    }

    const invoiceStatus = String((invoice as any)?.status ?? "").toUpperCase();
    if (invoiceStatus !== "AUTHORIZED") {
      throw new Error("O download de XML/PDF exige documento autorizado.");
    }

    const docType = normalizeDocType((invoice as any)?.docType);
    const endpoint = getDocumentEndpoint(docType);

    const headers = {
      Authorization: `Bearer ${ctx.token}`,
    };

    const [xmlProc, pdf] = await Promise.all([
      fetchTextOrThrow(
        `${ctx.baseUrl}/${endpoint}/${externalId}/xml`,
        headers,
        `Falha ao baixar XML processado da ${docType === "NFCE" ? "NFC-e" : "NF-e"}.`
      ),
      fetchBinaryAsBase64OrThrow(
        `${ctx.baseUrl}/${endpoint}/${externalId}/pdf`,
        headers,
        `Falha ao baixar PDF da ${docType === "NFCE" ? "NFC-e" : "NF-e"}.`
      ),
    ]);

    await persistDownloadedArtifacts(args.invoiceId, {
      provider: "NUVEMFISCAL",
      externalId,
      xmlProc,
      pdf,
    });

    return {
      ok: true,
      provider: "NUVEMFISCAL",
      externalId,
      xmlProc,
      pdf,
      raw: {
        xmlDownloaded: true,
        pdfDownloaded: true,
      },
    };
  },

  async cancel(args): Promise<ProviderCancelResult> {
    const ctx = await loadCompanyContext(args.companyId);

    const invoice = await prisma.fiscalInvoice.findUnique({
      where: { id: args.invoiceId },
      select: {
        id: true,
        externalId: true,
        status: true,
        docType: true,
      } as any,
    } as any);

    const externalId = text(args.externalId) || text((invoice as any)?.externalId);
    if (!externalId) {
      throw new Error("A invoice fiscal não possui externalId para cancelamento na Nuvem Fiscal.");
    }

    const invoiceStatus = String((invoice as any)?.status ?? "").toUpperCase();
    if (invoiceStatus !== "AUTHORIZED") {
      throw new Error("Somente documento autorizado pode ser cancelado.");
    }

    const docType = normalizeDocType((invoice as any)?.docType);
    const endpoint = getDocumentEndpoint(docType);
    const reason = text(args.reason) || "Cancelamento solicitado pelo operador.";

    const result = await nfFetchJson<any>(
      `${ctx.baseUrl}/${endpoint}/${externalId}/cancelamento`,
      {
        method: "POST",
        headers: getHeaders(ctx.token),
        body: JSON.stringify({
          justificativa: reason,
        }),
      },
      `Falha ao cancelar ${docType === "NFCE" ? "NFC-e" : "NF-e"} na Nuvem Fiscal.`
    );

    const mappedStatus = mapNuvemStatusToProvider(result?.status);
    const meta = extractCancelMeta(result);

    await persistCancelResult(args.invoiceId, result, reason);

    return {
      ok: true,
      provider: "NUVEMFISCAL",
      externalId,
      status: mappedStatus === "PENDING" ? "PENDING" : "CANCELLED",
      key: meta.key,
      protocol: meta.protocol,
      statusCode: meta.statusCode,
      statusReason: meta.statusReason,
      raw: result,
    };
  },
};
