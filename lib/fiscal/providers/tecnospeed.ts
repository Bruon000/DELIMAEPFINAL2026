import type { FiscalProvider } from "@/lib/fiscal/types";
import { createNotConfiguredProvider } from "@/lib/fiscal/errors";

export const tecnospeedProvider: FiscalProvider = createNotConfiguredProvider("TECNOSPEED") as FiscalProvider;
