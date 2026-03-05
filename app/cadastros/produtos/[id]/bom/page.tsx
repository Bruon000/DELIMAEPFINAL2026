"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

async function recalcCost(productId: string) {
  const res = await fetch(`/api/products/${productId}/recalc-cost`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao recalcular custo");
  return data;
}

async function fetchBom(productId: string) {
  const res = await fetch(`/api/products/${productId}/bom`);
  if (!res.ok) throw new Error("Erro ao carregar BOM");
  return res.json();
}

async function fetchMaterials() {
  const res = await fetch(`/api/materials`);
  if (!res.ok) return { materials: [] };
  return res.json();
}

async function addBomItem(productId: string, payload: any) {
  const res = await fetch(`/api/products/${productId}/bom/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao adicionar");
  return data;
}

async function deleteBomItem(id: string) {
  const res = await fetch(`/api/bom-items/${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao remover");
  return data;
}

async function updateBom(productId: string, payload: any) {
  const res = await fetch(`/api/products/${productId}/bom`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao salvar BOM");
  return data;
}

function pct(x: any) { return Number(x ?? 0); }
function n(x: any) { return Number(x ?? 0); }
function money(v: any) {
  const x = n(v);
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function BomPage() {
  const params = useParams();
  const productId = String(params.id);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["bom", productId], queryFn: () => fetchBom(productId) });
  const { data: mats } = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });

  const [materialId, setMaterialId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [lossItem, setLossItem] = React.useState(0);
  const [lossGlobal, setLossGlobal] = React.useState(0);
  const [msg, setMsg] = React.useState<string | null>(null);

  const addMut = useMutation({
    mutationFn: (p: any) => addBomItem(productId, p),
    onSuccess: async () => {
      setMsg("Item adicionado!");
      setMaterialId("");
      setQuantity(1);
      setLossItem(0);
      await qc.invalidateQueries({ queryKey: ["bom", productId] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteBomItem(id),
    onSuccess: async () => {
      setMsg("Item removido!");
      await qc.invalidateQueries({ queryKey: ["bom", productId] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const recalcMut = useMutation({
    mutationFn: () => recalcCost(productId),
    onSuccess: async () => {
      toast.success("Custo recalculado no produto (via BOM).");
      await qc.invalidateQueries({ queryKey: ["bom", productId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao recalcular custo"),
  });

  const saveBomMut = useMutation({
    mutationFn: (p: any) => updateBom(productId, p),
    onSuccess: async () => {
      setMsg("BOM atualizado!");
      await qc.invalidateQueries({ queryKey: ["bom", productId] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  React.useEffect(() => {
    if (data?.bom?.lossPercent != null) setLossGlobal(pct(data.bom.lossPercent));
  }, [data?.bom?.lossPercent]);

  const product = data?.product ?? null;
  const bom = data?.bom ?? null;
  const items = React.useMemo(() => {
    return (bom?.items ?? []) as any[];
  }, [bom?.items]);

  const lossG = pct(bom?.lossPercent);

  const computed = React.useMemo(() => {
    const rows = (items ?? []).map((it: any) => {
      const qty = n(it.quantity);
      const lossI = pct(it.lossPercent);
      const cost = n(it.material?.currentCost);
      const unit = it.material?.unit?.code ?? "";
      const need = qty * (1 + lossI / 100) * (1 + lossG / 100);
      const lineCost = need * cost;
      return { ...it, _qty: qty, _lossI: lossI, _need: need, _unit: unit, _cost: cost, _lineCost: lineCost };
    });
    const totalCost = rows.reduce((s: number, r: any) => s + n(r._lineCost), 0);
    return { rows, totalCost };
  }, [items, lossG]);

  if (isLoading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">BOM do Produto</h1>
        <Button asChild variant="outline">
          <Link href="/cadastros/produtos">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Produto</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <div><b>Nome:</b> {product?.name ?? "—"}</div>
          <div><b>Código:</b> {product?.code ?? "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Perdas (padrão industrial)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 items-end">
          <div className="space-y-1">
            <div className="text-sm font-medium">Perda global (%)</div>
            <Input type="number" step="0.01" min={0} value={lossGlobal} onChange={(e) => setLossGlobal(Number(e.target.value))} />
            <div className="text-xs text-muted-foreground">Aplica em todos os materiais (corte/sobra geral).</div>
          </div>
          <div className="md:col-span-2 flex gap-2">
            <Button disabled={saveBomMut.isPending || lossGlobal < 0} onClick={() => saveBomMut.mutate({ lossPercent: lossGlobal })}>
              {saveBomMut.isPending ? "Salvando..." : "Salvar perdas"}
            </Button>
            <Button variant="outline" onClick={() => setLossGlobal(pct(bom?.lossPercent))}>Reverter</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resumo (custo estimado)</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <div><b>Perda global:</b> {Number(lossG).toFixed(2)}%</div>
          <div><b>Custo estimado do BOM:</b> {money(computed.totalCost)}</div>
          <div className="text-xs text-muted-foreground">
            Cálculo: consumo real = qtd × (1 + perda item) × (1 + perda global), custo = consumo real × custo atual do material.
          </div>
          <div className="pt-2">
            <Button variant="secondary" disabled={recalcMut.isPending} onClick={() => recalcMut.mutate()}>
              {recalcMut.isPending ? "Recalculando..." : "Recalcular custo do produto"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Adicionar material</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select className="border rounded p-2" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">Material…</option>
            {(mats?.materials ?? []).map((m: any) => (
              <option key={m.id} value={m.id}>{m.code ? `${m.code} - ` : ""}{m.name}</option>
            ))}
          </select>

          <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          <div className="space-y-1">
            <div className="text-sm font-medium">Perda item (%)</div>
            <Input type="number" step="0.01" min={0} value={lossItem} onChange={(e) => setLossItem(Number(e.target.value))} placeholder="0" />
          </div>

          <Button disabled={!materialId || quantity <= 0 || addMut.isPending} onClick={() => addMut.mutate({ materialId, quantity, lossPercent: lossItem })}>
            {addMut.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Itens do BOM</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-muted-foreground">Sem itens ainda.</p>}
          {computed.rows.map((it: any) => (
            <div key={it.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">
                  {it.material?.code ? `${it.material.code} - ` : ""}{it.material?.name ?? it.materialId}
                </div>
                <div className="text-sm text-muted-foreground">
                  Qtd/base: {it._qty.toFixed(4)} {it._unit ? it._unit : ""} · Perda item: {it._lossI.toFixed(2)}% · Consumo real: {it._need.toFixed(4)} {it._unit ? it._unit : ""}
                </div>
                <div className="text-sm text-muted-foreground">
                  Custo atual: {money(it._cost)} · Custo do item: {money(it._lineCost)}
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => delMut.mutate(it.id)} disabled={delMut.isPending}>
                Remover
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
