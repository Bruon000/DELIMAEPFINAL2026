export type ProviderTestResponse = {
  ok: boolean;
  message: string;
  error?: string;
  status?: number | null;
  detail?: unknown;
  notes?: string[];
  result?: {
    ambiente: "homologacao" | "producao";
    companyCnpj: string;
    providerBaseUrl: string;
    sefazNfe?: unknown;
    sefazNfce?: unknown;
  };
};

export async function runProviderTest(): Promise<ProviderTestResponse> {
  const res = await fetch("/api/fiscal/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  return data as ProviderTestResponse;
}
