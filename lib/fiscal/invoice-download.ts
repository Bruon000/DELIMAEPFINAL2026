import type { ProviderDownloadResult } from "@/lib/fiscal/types";

export type InvoiceDownloadResponse = {
  ok: boolean;
  invoiceId: string;
  result: ProviderDownloadResult;
};

export async function runInvoiceDownload(invoiceId: string): Promise<InvoiceDownloadResponse> {
  const res = await fetch(`/api/fiscal/invoices/${invoiceId}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.message ?? data?.error ?? "Erro ao baixar XML/PDF da nota."));
  }
  return data as InvoiceDownloadResponse;
}
