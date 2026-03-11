import { NextResponse } from "next/server";
import { FiscalEnvironment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

type FiscalConfigPayload = {
  environment?: string;
  provider?: string;
  providerToken?: string;
  providerBaseUrl?: string;
  webhookSecret?: string;
  certificateType?: string;
  certificatePfxBase64?: string;
  certificatePassword?: string;
  csc?: string;
  cscId?: string;
};

function text(value: unknown) {
  const v = String(value ?? "").trim();
  return v ? v : "";
}

function upper(value: unknown) {
  return text(value).toUpperCase();
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidUrl(value: string) {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

type ConfigForReadiness = {
  provider?: string;
  environment?: string;
  providerToken?: string;
  providerBaseUrl?: string;
  webhookSecret?: string;
  certificatePfxBase64?: string;
  certificatePassword?: string;
  certificateType?: string;
  csc?: string;
  cscId?: string;
};

type CompanyFiscalForReadiness = {
  legalName?: string | null;
  ie?: string | null;
  crt?: number | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  cityCodeIbge?: string | null;
} | null;

function buildReadiness(config: ConfigForReadiness, companyFiscal: CompanyFiscalForReadiness) {
  const pending: string[] = [];

  if (!companyFiscal?.legalName) pending.push("Emitente sem razão social.");
  if (!companyFiscal?.ie) pending.push("Emitente sem inscrição estadual.");
  if (![1, 2, 3].includes(Number(companyFiscal?.crt))) pending.push("Emitente sem CRT.");
  if (!companyFiscal?.addressStreet) pending.push("Emitente sem logradouro fiscal.");
  if (!companyFiscal?.addressNumber) pending.push("Emitente sem número fiscal.");
  if (!companyFiscal?.addressDistrict) pending.push("Emitente sem bairro fiscal.");
  if (!companyFiscal?.addressCity) pending.push("Emitente sem município fiscal.");
  if (!companyFiscal?.addressState) pending.push("Emitente sem UF fiscal.");
  if (!digits(companyFiscal?.addressZip) || digits(companyFiscal?.addressZip).length !== 8) pending.push("Emitente sem CEP fiscal válido.");
  if (!digits(companyFiscal?.cityCodeIbge) || digits(companyFiscal?.cityCodeIbge).length !== 7) pending.push("Emitente sem cMun IBGE válido.");

  const provider = upper(config?.provider || "MOCK");
  const environment = upper(config?.environment || "HOMOLOG");

  if (!["HOMOLOG", "PROD"].includes(environment)) {
    pending.push("Ambiente fiscal inválido.");
  }

  if (!["MOCK", "NUVEMFISCAL", "TECNOSPEED", "FOCUSNFE"].includes(provider)) {
    pending.push("Provider fiscal inválido.");
  }

  if (provider !== "MOCK" && !text(config?.providerToken)) {
    pending.push("Provider real sem token/API key.");
  }

  if (provider !== "MOCK" && !text(config?.certificatePfxBase64)) {
    pending.push("Certificado A1/PFX não informado.");
  }

  if (provider !== "MOCK" && !text(config?.certificatePassword)) {
    pending.push("Senha do certificado não informada.");
  }

  if (!["A1", ""].includes(upper(config?.certificateType || "A1"))) {
    pending.push("Tipo de certificado inválido.");
  }

  if (!text(config?.csc)) {
    pending.push("CSC não informado.");
  }

  if (!digits(config?.cscId)) {
    pending.push("ID CSC não informado.");
  }

  return {
    ok: pending.length === 0,
    pending,
  };
}

export async function GET() {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;

  const [cfg, companyFiscal] = await Promise.all([
    prisma.fiscalConfig.findUnique({ where: { companyId } }),
    prisma.companyFiscal.findUnique({ where: { companyId } }),
  ]);

  const config: ConfigForReadiness = {
    environment: cfg?.environment ?? "HOMOLOG",
    provider: cfg?.provider ?? "MOCK",
    providerToken: cfg?.providerToken ?? "",
    providerBaseUrl: cfg?.providerBaseUrl ?? "",
    webhookSecret: cfg?.webhookSecret ?? "",
    certificateType: cfg?.certificateType ?? "A1",
    certificatePfxBase64: cfg?.certificatePfxBase64 ?? "",
    certificatePassword: cfg?.certificatePassword ?? "",
    csc: cfg?.csc ?? "",
    cscId: cfg?.cscId ?? "",
  };

  return NextResponse.json({
    config: {
      ...config,
      certificateUpdatedAt: cfg?.certificateUpdatedAt ?? null,
    },
    readiness: buildReadiness(config, companyFiscal),
  });
}

export async function PATCH(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const body = (await req.json().catch(() => null)) as FiscalConfigPayload | null;

  const environment = upper(body?.environment || "HOMOLOG");
  const provider = upper(body?.provider || "MOCK");
  const providerToken = text(body?.providerToken);
  const providerBaseUrl = text(body?.providerBaseUrl);
  const webhookSecret = text(body?.webhookSecret);
  const certificateType = upper(body?.certificateType || "A1");
  const certificatePfxBase64 = text(body?.certificatePfxBase64);
  const certificatePassword = text(body?.certificatePassword);
  const csc = text(body?.csc);
  const cscId = digits(body?.cscId);

  const allowedProviders = ["MOCK", "NUVEMFISCAL", "TECNOSPEED", "FOCUSNFE"];
  if (!allowedProviders.includes(provider)) {
    return NextResponse.json({ error: "invalid_provider", allowed: allowedProviders }, { status: 400 });
  }

  if (!["HOMOLOG", "PROD"].includes(environment)) {
    return NextResponse.json({ error: "invalid_environment", allowed: ["HOMOLOG", "PROD"] }, { status: 400 });
  }

  if (!["A1"].includes(certificateType)) {
    return NextResponse.json({ error: "invalid_certificate_type", allowed: ["A1"] }, { status: 400 });
  }

  if (providerBaseUrl && !isValidUrl(providerBaseUrl)) {
    return NextResponse.json({ error: "invalid_provider_base_url", message: "Base URL inválida." }, { status: 400 });
  }

  if (provider !== "MOCK" && !providerToken) {
    return NextResponse.json({ error: "missing_provider_token", message: "Informe o token/API key do provider fiscal." }, { status: 400 });
  }

  if (provider !== "MOCK" && !certificatePfxBase64) {
    return NextResponse.json({ error: "missing_certificate", message: "Informe o conteúdo do certificado PFX/P12 em base64." }, { status: 400 });
  }

  if (provider !== "MOCK" && !certificatePassword) {
    return NextResponse.json({ error: "missing_certificate_password", message: "Informe a senha do certificado." }, { status: 400 });
  }

  if (!csc) {
    return NextResponse.json({ error: "missing_csc", message: "Informe o CSC para NFC-e." }, { status: 400 });
  }

  if (!cscId) {
    return NextResponse.json({ error: "missing_csc_id", message: "Informe o ID do CSC." }, { status: 400 });
  }

  const updated = await prisma.fiscalConfig.upsert({
    where: { companyId },
    update: {
      environment: environment as FiscalEnvironment,
      provider,
      providerToken: providerToken || null,
      providerBaseUrl: providerBaseUrl || null,
      webhookSecret: webhookSecret || null,
      certificateType,
      certificatePfxBase64: certificatePfxBase64 || null,
      certificatePassword: certificatePassword || null,
      csc: csc || null,
      cscId: cscId || null,
      certificateUpdatedAt: certificatePfxBase64 ? new Date() : undefined,
    },
    create: {
      companyId,
      environment: environment as FiscalEnvironment,
      provider,
      providerToken: providerToken || null,
      providerBaseUrl: providerBaseUrl || null,
      webhookSecret: webhookSecret || null,
      certificateType,
      certificatePfxBase64: certificatePfxBase64 || null,
      certificatePassword: certificatePassword || null,
      csc: csc || null,
      cscId: cscId || null,
      certificateUpdatedAt: certificatePfxBase64 ? new Date() : undefined,
    },
  });

  const companyFiscal = await prisma.companyFiscal.findUnique({
    where: { companyId },
  });

  const configForReadiness: ConfigForReadiness = {
    environment: updated.environment ?? "HOMOLOG",
    provider: updated.provider ?? "MOCK",
    providerToken: updated.providerToken ?? "",
    providerBaseUrl: updated.providerBaseUrl ?? "",
    webhookSecret: updated.webhookSecret ?? "",
    certificateType: updated.certificateType ?? "A1",
    certificatePfxBase64: updated.certificatePfxBase64 ?? "",
    certificatePassword: updated.certificatePassword ?? "",
    csc: updated.csc ?? "",
    cscId: updated.cscId ?? "",
  };

  return NextResponse.json({
    ok: true,
    config: {
      ...configForReadiness,
      certificateUpdatedAt: updated.certificateUpdatedAt ?? null,
    },
    readiness: buildReadiness(configForReadiness, companyFiscal),
  });
}
