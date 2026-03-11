import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function onlyDigits(v: unknown) {
  return String(v ?? "").replace(/\D/g, "");
}

function detectDocType(document: string) {
  const raw = String(document ?? "").trim().toUpperCase();
  if (raw === "WALKIN") return "WALKIN";
  const d = onlyDigits(document);
  if (d.length === 14) return "CNPJ";
  return "CPF";
}

function buildFiscalReadiness(client: {
  name?: string | null;
  document?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  cityCodeIbge?: string | null;
}) {
  const docType = detectDocType(String(client.document ?? ""));
  const isWalkin = docType === "WALKIN";
  const isCnpj = docType === "CNPJ";

  const missingBase: string[] = [];
  const missingNfe: string[] = [];

  if (!String(client.name ?? "").trim()) missingBase.push("name");
  if (!isWalkin && !String(client.document ?? "").trim()) missingBase.push("document");

  if (!isWalkin && !String(client.document ?? "").trim()) {
    missingNfe.push("document");
  }

  // Regras:
  // - WALKIN: serve para NFC-e, não para NF-e completa
  // - CPF: NF-e pode existir com base simples (nome + documento)
  // - CNPJ: endereço principal é esperado
  if (!String(client.name ?? "").trim()) missingNfe.push("name");

  if (isCnpj) {
    if (!String(client.addressStreet ?? "").trim()) missingNfe.push("addressStreet");
    if (!String(client.addressNumber ?? "").trim()) missingNfe.push("addressNumber");
    if (!String(client.addressDistrict ?? "").trim()) missingNfe.push("addressDistrict");
    if (!String(client.addressCity ?? "").trim()) missingNfe.push("addressCity");
    if (!String(client.addressState ?? "").trim()) missingNfe.push("addressState");
  }

  if (isWalkin) missingNfe.push("document");

  return {
    docType,
    nfceReady: missingBase.length === 0,
    nfeReady: missingNfe.length === 0,
    missingBase,
    missingNfe,
  };
}

export async function GET() {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;

  const clients = await prisma.client.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      tradeName: true,
      document: true,
      ie: true,
      im: true,
      email: true,
      phone: true,
      addressStreet: true,
      addressNumber: true,
      addressDistrict: true,
      addressCity: true,
      addressState: true,
      addressZip: true,
      cityCodeIbge: true,
      isActive: true,
    } as const,
    take: 500,
  });

  return NextResponse.json({
    clients: clients.map((c) => ({
      ...c,
      readiness: buildFiscalReadiness(c),
    })),
  });
}

export async function POST(req: Request) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const document = String(body?.document ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = String(body?.phone ?? "").trim();

  const tradeName = String(body?.tradeName ?? "").trim();
  const ie = String(body?.ie ?? "").trim();
  const im = String(body?.im ?? "").trim();

  const addressStreet = String(body?.addressStreet ?? "").trim();
  const addressNumber = String(body?.addressNumber ?? "").trim();
  const addressDistrict = String(body?.addressDistrict ?? "").trim();
  const addressCity = String(body?.addressCity ?? "").trim();
  const addressState = String(body?.addressState ?? "").trim().toUpperCase();
  const addressZip = String(body?.addressZip ?? "").trim();
  const cityCodeIbge = String(body?.cityCodeIbge ?? "").trim();

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const digits = onlyDigits(document);
  if (document && digits.length !== 11 && digits.length !== 14 && document.toUpperCase() !== "WALKIN") {
    return NextResponse.json(
      { error: "invalid_document", message: "Documento deve ser CPF, CNPJ ou WALKIN." },
      { status: 400 },
    );
  }

  const existing = document
    ? await prisma.client.findFirst({
        where: { companyId, document, deletedAt: null } as any,
        select: { id: true, name: true } as any,
      } as any)
    : null;

  if (existing?.id) {
    return NextResponse.json(
      { error: "document_already_exists", message: `Já existe cliente com este documento: ${existing.name}` },
      { status: 409 },
    );
  }

  const client = await prisma.client.create({
    data: {
      id: `cli_${Date.now()}`,
      companyId,
      name,
      document: document || null,
      email: email || null,
      phone: phone || null,
      tradeName: tradeName || null,
      ie: ie || null,
      im: im || null,
      addressStreet: addressStreet || null,
      addressNumber: addressNumber || null,
      addressDistrict: addressDistrict || null,
      addressCity: addressCity || null,
      addressState: addressState || null,
      addressZip: addressZip || null,
      cityCodeIbge: cityCodeIbge || null,
      isActive: true,
    } as any,
    select: {
      id: true,
      name: true,
      tradeName: true,
      document: true,
      ie: true,
      im: true,
      email: true,
      phone: true,
      addressStreet: true,
      addressNumber: true,
      addressDistrict: true,
      addressCity: true,
      addressState: true,
      addressZip: true,
      cityCodeIbge: true,
      isActive: true,
    },
  } as any);

  return NextResponse.json(
    {
      client: {
        ...client,
        readiness: buildFiscalReadiness(client),
      },
    },
    { status: 201 },
  );
}
