import type { ProviderCancelResult } from "@/lib/fiscal/types";

export type InvoiceCancelResponse = {
  ok: boolean;
  invoiceId: string;
  result: ProviderCancelResult;
};

export async function runInvoiceCancel(invoiceId: string, reason: string): Promise<InvoiceCancelResponse> {
  const res = await fetch(`/api/fiscal/invoices/${invoiceId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.message ?? data?.error ?? "Erro ao cancelar NF-e."));
  }
  return data as InvoiceCancelResponse;
}
