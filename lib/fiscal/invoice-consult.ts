import type { ProviderConsultResult } from "@/lib/fiscal/types";

export type InvoiceConsultResponse = {
  ok: boolean;
  invoiceId: string;
  result: ProviderConsultResult;
};

export async function runInvoiceConsult(invoiceId: string): Promise<InvoiceConsultResponse> {
  const res = await fetch(`/api/fiscal/invoices/${invoiceId}/consult`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.message ?? data?.error ?? "Erro ao consultar documento fiscal."));
  }
  return data as InvoiceConsultResponse;
}
