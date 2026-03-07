"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function fetchConfig() {
  const res = await fetch("/api/fiscal/config");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar config fiscal");
  return data?.config ?? null;
}

async function saveConfig(payload: {
  provider: string;
  providerToken: string;
  providerBaseUrl: string;
  webhookSecret: string;
}) {
  const res = await fetch("/api/fiscal/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao salvar config fiscal");
  return data?.config ?? null;
}

export default function ConfigFiscalPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["fiscal-config"], queryFn: fetchConfig });

  const [provider, setProvider] = React.useState("MOCK");
  const [providerToken, setProviderToken] = React.useState("");
  const [providerBaseUrl, setProviderBaseUrl] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");

  React.useEffect(() => {
    if (!q.data) return;
    setProvider(String(q.data?.provider ?? "MOCK"));
    setProviderToken(String(q.data?.providerToken ?? ""));
    setProviderBaseUrl(String(q.data?.providerBaseUrl ?? ""));
    setWebhookSecret(String(q.data?.webhookSecret ?? ""));
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () => saveConfig({ provider, providerToken, providerBaseUrl, webhookSecret }),
    onSuccess: async () => {
      toast.success("Config fiscal salva.");
      await qc.invalidateQueries({ queryKey: ["fiscal-config"] });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configurações Fiscal</h1>
        <Button asChild variant="outline">
          <Link href="/configuracoes">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Emissor fiscal (plugável)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {q.isLoading ? <div className="text-sm text-muted-foreground">Carregando...</div> : null}
          {q.isError ? <div className="text-sm text-destructive">Erro: {(q.error as Error)?.message ?? "falha"}</div> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Provider</Label>
              <select className="border rounded p-2 w-full" value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option value="MOCK">MOCK (teste)</option>
                <option value="NUVEMFISCAL">NUVEM FISCAL</option>
                <option value="TECNOSPEED">TECNOSPEED</option>
                <option value="FOCUSNFE">FOCUS NFE</option>
              </select>
              <div className="text-xs text-muted-foreground">
                A emissão continua &quot;mock&quot; até você plugar o provider real em <code>lib/fiscal-provider.ts</code>.
              </div>
            </div>

            <div className="space-y-1">
              <Label>Token / API Key</Label>
              <Input
                value={providerToken}
                onChange={(e) => setProviderToken(e.target.value)}
                placeholder="Cole aqui o token do emissor"
              />
              <div className="text-xs text-muted-foreground">
                Apenas ADMIN. O CAIXA só emite.
              </div>
            </div>

            <div className="space-y-1">
              <Label>Base URL do provider</Label>
              <Input
                value={providerBaseUrl}
                onChange={(e) => setProviderBaseUrl(e.target.value)}
                placeholder="https://api.do-emissor.com"
              />
            </div>

            <div className="space-y-1">
              <Label>Webhook secret</Label>
              <Input
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Segredo para validar callbacks"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
