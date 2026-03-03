"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchCfg() {
  const res = await fetch("/api/pricing-config");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao carregar");
  return data.pricingConfig ?? null;
}

async function saveCfg(payload: any) {
  const res = await fetch("/api/pricing-config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
  return data.pricingConfig;
}

export default function PrecosConfigPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["pricing-config"], queryFn: fetchCfg });

  const [form, setForm] = React.useState<any>({
    defaultMode: "MARGIN",
    defaultMarginPercent: 30,
    defaultMarkupPercent: 0,
    rounding: "R99",
    minMarginPercent: "",
    overheadPercent: "",
    feesPercent: "",
  });

  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!data) return;
    setForm({
      defaultMode: data.defaultMode ?? "MARGIN",
      defaultMarginPercent: Number(data.defaultMarginPercent ?? 30),
      defaultMarkupPercent: Number(data.defaultMarkupPercent ?? 0),
      rounding: data.rounding ?? "R99",
      minMarginPercent: data.minMarginPercent !== null && data.minMarginPercent !== undefined ? Number(data.minMarginPercent) : "",
      overheadPercent: data.overheadPercent !== null && data.overheadPercent !== undefined ? Number(data.overheadPercent) : "",
      feesPercent: data.feesPercent !== null && data.feesPercent !== undefined ? Number(data.feesPercent) : "",
    });
  }, [data]);

  const mut = useMutation({
    mutationFn: saveCfg,
    onSuccess: async () => {
      setMsg("Configuração salva!");
      await qc.invalidateQueries({ queryKey: ["pricing-config"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configurações de Preço (Premium)</h1>
        <Button asChild variant="outline"><Link href="/configuracoes">Voltar</Link></Button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Regra padrão da empresa</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-sm font-medium">Modo</div>
            <select className="border rounded p-2 w-full" value={form.defaultMode}
              onChange={(e) => setForm({ ...form, defaultMode: e.target.value })}>
              <option value="MARGIN">MARGIN (margem)</option>
              <option value="MARKUP">MARKUP (sobre custo)</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Arredondamento</div>
            <select className="border rounded p-2 w-full" value={form.rounding}
              onChange={(e) => setForm({ ...form, rounding: e.target.value })}>
              <option value="R99">Terminar em .99</option>
              <option value="R05">Múltiplos de 0,50</option>
              <option value="NONE">Normal (2 casas)</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Margem padrão (%)</div>
            <Input type="number" step="0.01" value={form.defaultMarginPercent}
              onChange={(e) => setForm({ ...form, defaultMarginPercent: Number(e.target.value) })}/>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Markup padrão (%)</div>
            <Input type="number" step="0.01" value={form.defaultMarkupPercent}
              onChange={(e) => setForm({ ...form, defaultMarkupPercent: Number(e.target.value) })}/>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Margem mínima (%) (opcional)</div>
            <Input type="number" step="0.01" value={form.minMarginPercent}
              onChange={(e) => setForm({ ...form, minMarginPercent: e.target.value })}/>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Overhead (%) (opcional)</div>
            <Input type="number" step="0.01" value={form.overheadPercent}
              onChange={(e) => setForm({ ...form, overheadPercent: e.target.value })}/>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-medium">Taxas (%) (opcional)</div>
            <Input type="number" step="0.01" value={form.feesPercent}
              onChange={(e) => setForm({ ...form, feesPercent: e.target.value })}/>
          </div>

          <div className="flex gap-2 items-end">
            <Button disabled={mut.isPending} onClick={() => mut.mutate(form)}>
              {mut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
