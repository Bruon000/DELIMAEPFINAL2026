import type { FiscalProvider } from "@/lib/fiscal/types";
import { createNotConfiguredProvider } from "@/lib/fiscal/errors";

// Stub inicial: mantém arquitetura pronta sem acoplar a implementação real agora.
export const nuvemFiscalProvider: FiscalProvider = createNotConfiguredProvider("NUVEMFISCAL") as FiscalProvider;
