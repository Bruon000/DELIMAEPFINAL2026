import type { FiscalProvider } from "@/lib/fiscal/types";
import { createNotConfiguredProvider } from "@/lib/fiscal/errors";

export const focusNfeProvider: FiscalProvider = createNotConfiguredProvider("FOCUSNFE") as FiscalProvider;
