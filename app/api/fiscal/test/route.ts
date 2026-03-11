import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { syncNuvemFiscalSetup } from "@/lib/fiscal/providers/nuvemfiscal";

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export async function POST() {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;

  const [cfg, company] = await Promise.all([
    prisma.fiscalConfig.findUnique({ where: { companyId } }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, document: true },
    }),
  ]);

  const provider = String(cfg?.provider ?? "MOCK").toUpperCase();
  if (provider !== "NUVEMFISCAL") {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_provider_for_test",
        message: "Selecione NUVEMFISCAL na configuração fiscal antes de testar o provider.",
        provider,
      },
      { status: 409 }
    );
  }

  try {
    const result = await syncNuvemFiscalSetup(companyId);

    return NextResponse.json({
      ok: true,
      message: "Setup externo da Nuvem Fiscal concluído com sucesso.",
      company: {
        id: company?.id ?? null,
        name: company?.name ?? null,
        document: digits(company?.document),
      },
      result,
      notes: [
        "Empresa sincronizada na Nuvem Fiscal.",
        "Certificado enviado/atualizado.",
        "Serviços NF-e e NFC-e configurados no ambiente selecionado.",
        "Status da SEFAZ consultado.",
        "O próximo passo é mapear o payload interno para POST /nfe e POST /nfce.",
      ],
    });
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number; body?: unknown };
    return NextResponse.json(
      {
        ok: false,
        error: "nuvemfiscal_setup_failed",
        message: String(err?.message ?? "Falha ao testar provider Nuvem Fiscal."),
        status: err?.status ?? null,
        detail: err?.body ?? null,
      },
      { status: 400 }
    );
  }
}
