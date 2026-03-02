"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


function statusBadge(st: string) {
  const s = String(st || "");
  const base = "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold";
  if (s === "RECEIVED") return <span className={`${base} bg-emerald-100 text-emerald-800`}>RECEIVED</span>;
  if (s === "SENT") return <span className={`${base} bg-blue-100 text-blue-800`}>SENT</span>;
  if (s === "CANCELED") return <span className={`${base} bg-red-100 text-red-800`}>CANCELED</span>;
  return <span className={`${base} bg-zinc-100 text-zinc-800`}>DRAFT</span>;
}

async function markSent(poId: string) {
  const res = await fetch(`/api/purchase-orders/${poId}/send`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao marcar como enviado");
  return data;
}

async function cancelPO(poId: string) {
  const res = await fetch(`/api/purchase-orders/${poId}/cancel`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao cancelar");
  return data;
}

async function fetchPO(id: string) {
  const res = await fetch(`/api/purchase-orders/${id}`);
  if (!res.ok) throw new Error("Erro ao carregar pedido de compra");
  return res.json();
}

async function fetchMaterials() {
  const res = await fetch("/api/materials");
  if (!res.ok) throw new Error("Erro ao carregar materiais");
  return res.json();
}

async function addItem(poId: string, payload: any) {
  const res = await fetch(`/api/purchase-orders/${poId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao adicionar item");
  return data;
}

async function removeItem(id: string) {
  const res = await fetch(`/api/purchase-order-items/${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao remover item");
  return data;
}

async function receive(poId: string) {
  const res = await fetch(`/api/purchase-orders/${poId}/receive`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao receber");
  return data;
}

export default function CompraDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["po", id], queryFn: () => fetchPO(id) });
  const { data: mats } = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });

  const po = data?.purchaseOrder;
  const items = po?.items ?? [];
  const status = String(po?.status ?? "");

  const [materialId, setMaterialId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [unitCost, setUnitCost] = React.useState(0);
  const [msg, setMsg] = React.useState<string | null>(null);

  const addMut = useMutation({
    mutationFn: (p: any) => addItem(id, p),
    onSuccess: async () => {
      setMsg("Item adicionado!");
      setMaterialId("");
      setQuantity(1);
      setUnitCost(0);
      await qc.invalidateQueries({ queryKey: ["po", id] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (itemId: string) => removeItem(itemId),
    onSuccess: async () => {
      setMsg("Item removido!");
      await qc.invalidateQueries({ queryKey: ["po", id] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const recMut = useMutation({
    mutationFn: () => receive(id),
    onSuccess: async (d: any) => {
      const updatedCosts = (d as any)?.updatedCosts ?? [];
      if (updatedCosts.length) {
        setMsg(`Compra recebida! Estoque atualizado. Custos atualizados em ${updatedCosts.length} material(is).`);
      } else {
        setMsg("Compra recebida! Estoque atualizado e ledger gravado.");
      }
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.invalidateQueries({ queryKey: ["po", id] });
      await qc.invalidateQueries({ queryKey: ["stock-ledger"] });
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      await qc.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const sendMut = useMutation({
    mutationFn: () => markSent(id),
    onSuccess: async () => {
      setMsg("Pedido marcado como ENVIADO!");
      await qc.invalidateQueries({ queryKey: ["po", id] });
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      await qc.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const cancelMut = useMutation({
    mutationFn: async () => { if (!confirm("Cancelar este pedido de compra?")) return; return cancelPO(id); },
    onSuccess: async () => {
      setMsg("Pedido CANCELADO!");
      await qc.invalidateQueries({ queryKey: ["po", id] });
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      await qc.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;
  if (!po) return <div className="p-6">Não encontrado.</div>;

  const total = items.reduce((s: number, it: any) => s + Number(it.total ?? 0), 0);
  const canEdit = status === "DRAFT";

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Pedido de Compra</h1>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center gap-2"><b>Status:</b> {statusBadge(po.status)}</div>
          <div>
  <b>Fornecedor:</b> {po.supplier?.name ?? "-"}
  {po.supplier?.document ? <span className="text-sm text-muted-foreground"> · Doc: {po.supplier.document}</span> : null}
  {po.supplier?.phone ? <span className="text-sm text-muted-foreground"> · Tel: {po.supplier.phone}</span> : null}
</div>
          <div><b>Total:</b> R$ {Number(total).toFixed(2)}</div>

          <div className="pt-2 flex gap-2">
            
<Button
  variant="outline"
  disabled={sendMut.isPending || !items.length || status !== "DRAFT"}
  onClick={() => {
    if (!window.confirm("Marcar este pedido como ENVIADO?")) return;
    sendMut.mutate();
  }}
>
  {sendMut.isPending ? "Enviando..." : "Marcar como Enviado"}
</Button>

<Button
  variant="destructive"
  disabled={cancelMut.isPending || (status !== "DRAFT" && status !== "SENT")}
  onClick={() => {
    if (!window.confirm("Cancelar este pedido?")) return;
    cancelMut.mutate();
  }}
>
  {cancelMut.isPending ? "Cancelando..." : "Cancelar"}
</Button>

<Button
  disabled={recMut.isPending || !items.length || status !== "SENT"}
  onClick={() => {
    if (!window.confirm("Confirmar RECEBIMENTO? Isso vai dar entrada no estoque e atualizar custos.")) return;
    recMut.mutate();
  }}
>
  {recMut.isPending ? "Recebendo..." : "Receber compra (entrada estoque)"}
</Button>
</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Adicionar item</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select className="border rounded p-2" value={materialId} onChange={(e) => setMaterialId(e.target.value)} disabled={!canEdit}>
            <option value="">Material…</option>
            {(mats?.materials ?? []).map((m: any) => (
              <option key={m.id} value={m.id}>{m.code ? `${m.code} - ` : ""}{m.name}</option>
            ))}
          </select>

          <Input type="number" step="0.0001" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} disabled={!canEdit} />
          <Input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} disabled={!canEdit} />

          <Button disabled={!canEdit || !materialId || quantity <= 0 || addMut.isPending} onClick={() => addMut.mutate({ materialId, quantity, unitCost })}>
            {addMut.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Itens</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-muted-foreground">Sem itens.</p>}
          {items.map((it: any) => (
            <div key={it.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{it.material?.name ?? it.materialId}</div>
                <div className="text-sm text-muted-foreground">
                  Qtd {Number(it.quantity ?? 0).toFixed(4)} · Custo {Number(it.unitCost ?? 0).toFixed(2)} · Total {Number(it.total ?? 0).toFixed(2)}
                </div>
              </div>
              <Button variant="destructive" size="sm" disabled={!canEdit || delMut.isPending} onClick={() => delMut.mutate(it.id)}>
                Remover
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}




