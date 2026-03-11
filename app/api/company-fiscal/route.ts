import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

type CompanyFiscalPayload = {
  legalName?: string | null;
  tradeName?: string | null;
  ie?: string | null;
  crt?: number | string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  cityCodeIbge?: string | null;
};

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function upper(value: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function text(value: unknown) {
  const v = String(value ?? "").trim();
  return v ? v : null;
}

function validateFiscal(body: CompanyFiscalPayload) {
  const issues: string[] = [];

  const crt = body?.crt != null && String(body.crt).trim() !== "" ? Number(body.crt) : null;
  const addressState = upper(body?.addressState);
  const addressZip = digits(body?.addressZip);
  const cityCodeIbge = digits(body?.cityCodeIbge);

  if (crt != null && ![1, 2, 3].includes(crt)) {
    issues.push("CRT inválido. Use 1, 2 ou 3.");
  }

  if (addressState && !/^[A-Z]{2}$/.test(addressState)) {
    issues.push("UF inválida. Use a sigla com 2 letras.");
  }

  if (addressZip && addressZip.length !== 8) {
    issues.push("CEP inválido. Informe 8 dígitos.");
  }

  if (cityCodeIbge && cityCodeIbge.length !== 7) {
    issues.push("Código IBGE do município inválido. Informe 7 dígitos.");
  }

  return {
    crt,
    addressState: addressState || null,
    addressZip: addressZip || null,
    cityCodeIbge: cityCodeIbge || null,
    issues,
  };
}

function buildReadiness(row: { legalName?: string | null; ie?: string | null; crt?: number | null; addressStreet?: string | null; addressNumber?: string | null; addressDistrict?: string | null; addressCity?: string | null; addressState?: string | null; addressZip?: string | null; cityCodeIbge?: string | null } | null) {
  const pending: string[] = [];

  if (!row?.legalName) pending.push("Razão social do emitente não informada.");
  if (!row?.ie) pending.push("Inscrição Estadual não informada.");
  if (![1, 2, 3].includes(Number(row?.crt))) pending.push("CRT do emitente não informado.");
  if (!row?.addressStreet) pending.push("Logradouro fiscal não informado.");
  if (!row?.addressNumber) pending.push("Número do endereço fiscal não informado.");
  if (!row?.addressDistrict) pending.push("Bairro fiscal não informado.");
  if (!row?.addressCity) pending.push("Município fiscal não informado.");
  if (!row?.addressState) pending.push("UF fiscal não informada.");
  if (!digits(row?.addressZip) || digits(row?.addressZip).length !== 8) pending.push("CEP fiscal inválido ou ausente.");
  if (!digits(row?.cityCodeIbge) || digits(row?.cityCodeIbge).length !== 7) pending.push("cMun IBGE do emitente inválido ou ausente.");

  return {
    ok: pending.length === 0,
    pending,
  };
}

export async function GET() {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const row = await prisma.companyFiscal.findUnique({
    where: { companyId },
  });

  return NextResponse.json({
    fiscal: row ?? null,
    readiness: buildReadiness(row),
  });
}

export async function PATCH(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const body = (await req.json().catch(() => ({}))) as CompanyFiscalPayload;

  const normalized = validateFiscal(body);

  if (normalized.issues.length > 0) {
    return NextResponse.json(
      {
        error: "validation_error",
        message: "Existem campos fiscais inválidos.",
        issues: normalized.issues,
      },
      { status: 400 }
    );
  }

  const payload = {
    legalName: text(body?.legalName),
    tradeName: text(body?.tradeName),
    ie: text(body?.ie),
    crt: normalized.crt,
    addressStreet: text(body?.addressStreet),
    addressNumber: text(body?.addressNumber),
    addressDistrict: text(body?.addressDistrict),
    addressCity: text(body?.addressCity),
    addressState: normalized.addressState,
    addressZip: normalized.addressZip,
    cityCodeIbge: normalized.cityCodeIbge,
  };

  const row = await prisma.companyFiscal.upsert({
    where: { companyId },
    create: {
      companyId,
      ...payload,
    },
    update: {
      ...payload,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    fiscal: row,
    readiness: buildReadiness(row),
  });
}
