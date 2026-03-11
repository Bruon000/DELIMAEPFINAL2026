import { prisma } from "@/lib/prisma";
import type { FiscalProvider, FiscalDocType, FiscalEmitPayload, ProviderEmitResult, ProviderConsultResult, ProviderCancelResult } from "@/lib/fiscal/types";
import { mockProvider } from "@/lib/fiscal/providers/mock";
import { nuvemFiscalProvider } from "@/lib/fiscal/providers/nuvemfiscal";
import { focusNfeProvider } from "@/lib/fiscal/providers/focusnfe";
import { tecnospeedProvider } from "@/lib/fiscal/providers/tecnospeed";
import { createNotConfiguredProvider } from "@/lib/fiscal/errors";

export type { FiscalProvider, FiscalDocType, FiscalEmitPayload, ProviderEmitResult, ProviderConsultResult, ProviderCancelResult };
export { mockProvider };

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
  if (!token) return createNotConfiguredProvider(provider) as FiscalProvider;

  if (provider === "NUVEMFISCAL") return nuvemFiscalProvider;
  if (provider === "FOCUSNFE") return focusNfeProvider;
  if (provider === "TECNOSPEED") return tecnospeedProvider;

  return createNotConfiguredProvider(provider) as FiscalProvider;
}
