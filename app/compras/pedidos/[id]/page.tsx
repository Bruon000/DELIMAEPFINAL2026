"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/page-header";
import { PurchaseOrderStatusBadge } from "@/components/erp/status-badge";
import { DataTable, type Column } from "@/components/erp/data-table";

async function fetchPO(id: string) {
  const res = await fetch(`/api/purchase-orders/${id}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao carregar pedido de compra");
  return data;
}

async function fetchMaterials() {
  const res = await fetch("/api/materials");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao carregar materiais");
  return data;
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

async function receivePO(poId: string) {
  const res = await fetch(`/api/purchase-orders/${poId}/receive`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao receber");
  return data;
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

function money(n: any) {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CompraDetailPage() {
  const params = useParams();
  const id = String((params as any).id);
  const qc = useQueryClient();

  const poQ = useQuery({ queryKey: ["po", id], queryFn: () => fetchPO(id) });
  const matsQ = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });

  const po = poQ.data?.purchaseOrder;
  const items = (po?.items ?? []) as any[];
  const status = String(po?.status ?? "").toUpperCase();

  const [materialId, setMaterialId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [unitCost, setUnitCost] = React.useState(0);
  const [msg, setMsg] = React.useState<string | null>(null);

  const total = React.useMemo(() => {
    return items.reduce((s: number, it: any) => s + Number(it.total ?? 0), 0);
  }, [items]);

  const canEdit = status === "DRAFT";
  const canSend = status === "DRAFT" && items.length > 0;
  const canCancel = status === "DRAFT" || status === "SENT";
  const canReceive = status === "SENT" && items.length > 0;

  const addMut = useMutation({
    mutationFn: (p: any) => addItem(id, p),
    onSuccess: async () => {
      setMsg("Item adicionado.");
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
      setMsg("Item removido.");
      await qc.invalidateQueries({ queryKey: ["po", id] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!window.confirm("Marcar este pedido como ENVIADO?")) return;
      return markSent(id);
    },
    onSuccess: async () => {
      setMsg("Pedido marcado como ENVIADO.");
      await qc.invalidateQueries({ queryKey: ["po", id] });
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const cancelMut = useMutation({
    mutationFn: async () => {
      if (!window.confirm("Cancelar este pedido de compra?")) return;
      return cancelPO(id);
    },
    onSuccess: async () => {
      setMsg("Pedido CANCELADO.");
      await qc.invalidateQueries({ queryKey: ["po", id] });
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const recMut = useMutation({
    mutationFn: async () => {
      if (!window.confirm("Confirmar RECEBIMENTO? Isso vai dar entrada no estoque e atualizar custos.")) return;
      return receivePO(id);
    },
    onSuccess: async (d: any) => {
      const updatedCosts = d?.updatedCosts ?? [];
      setMsg(
        updatedCosts.length
          ? `Compra recebida! Custos atualizados em ${updatedCosts.length} material(is).`
          : "Compra recebida! Estoque/ledger atualizados."
      );
      await qc.invalidateQueries({ queryKey: ["po", id] });
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.invalidateQueries({ queryKey: ["stock-ledger"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  if (poQ.isLoading) return <div className="p-6">Carregando...</div>;
  if (poQ.error || !po) return <div className="p-6 text-sm text-red-600">Falha ao carregar o pedido.</div>;

  const columns: Column<any>[] = [
    {
      key: "material",
      header: "Material",
      cell: (it) => (
        <div className="min-w-[260px]">
          <div className="font-medium">{it.material?.name ?? it.materialId}</div>
          {it.material?.code ? <div className="text-xs text-muted-foreground">Código: {it.material.code}</div> : null}
        </div>
      ),
    },
    {
      key: "qty",
      header: "Qtd",
      headerClassName: "w-[120px]",
      className: "text-right tabular-nums",
      cell: (it) => Number(it.quantity ?? 0).toFixed(4),
    },
    {
      key: "unit",
      header: "Custo unit.",
      headerClassName: "w-[140px]",
      className: "text-right tabular-nums",
      cell: (it) => money(it.unitCost ?? 0),
    },
    {
      key: "total",
      header: "Total",
      headerClassName: "w-[140px]",
      className: "text-right tabular-nums",
      cell: (it) => money(it.total ?? 0),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[120px]",
      className: "text-right",
      cell: (it) => (
        <Button
          variant="destructive"
          size="sm"
          disabled={!canEdit || delMut.isPending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!window.confirm("Remover este item?")) return;
            delMut.mutate(it.id);
          }}
        >
          Remover
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Pedido de Compra"
        subtitle="Fluxo industrial: rascunho → enviado → recebido (entrada em estoque + ledger + custo atualizado)."
        meta={<PurchaseOrderStatusBadge status={po.status} />}
        actions={
          <>
            <Button variant="outline" disabled={!canSend || sendMut.isPending} onClick={() => sendMut.mutate()}>
              {sendMut.isPending ? "Enviando..." : "Marcar como Enviado"}
            </Button>

            <Button variant="destructive" disabled={!canCancel || cancelMut.isPending} onClick={() => cancelMut.mutate()}>
              {cancelMut.isPending ? "Cancelando..." : "Cancelar"}
            </Button>

            <Button disabled={!canReceive || recMut.isPending} onClick={() => recMut.mutate()}>
              {recMut.isPending ? "Recebendo..." : "Receber (entrada estoque)"}
            </Button>
          </>
        }
      />

      {msg ? <div className="text-sm text-muted-foreground">{msg}</div> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm md:grid-cols-2">
            <div><b>ID:</b> {po.id}</div>
            <div><b>Status:</b> {status}</div>
            <div className="md:col-span-2">
              <b>Fornecedor:</b> {po.supplier?.name ?? "-"}
              {po.supplier?.document ? <span className="text-muted-foreground"> · Doc: {po.supplier.document}</span> : null}
              {po.supplier?.phone ? <span className="text-muted-foreground"> · Tel: {po.supplier.phone}</span> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-2xl font-bold tabular-nums">{money(total)}</div>
            <div className="text-xs text-muted-foreground">Itens: {items.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adicionar item</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            disabled={!canEdit || matsQ.isLoading}
          >
            <option value="">{matsQ.isLoading ? "Carregando materiais..." : "Selecione um material…"}</option>
            {(matsQ.data?.materials ?? []).map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.code ? `${m.code} - ` : ""}{m.name}
              </option>
            ))}
          </select>

          <Input
            type="number"
            step="0.0001"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            disabled={!canEdit}
            placeholder="Quantidade"
          />

          <Input
            type="number"
            step="0.01"
            value={unitCost}
            onChange={(e) => setUnitCost(Number(e.target.value))}
            disabled={!canEdit}
            placeholder="Custo unit."
          />

          <Button
            disabled={!canEdit || !materialId || quantity <= 0 || addMut.isPending}
            onClick={() => addMut.mutate({ materialId, quantity, unitCost })}
          >
            {addMut.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </CardContent>
      </Card>

      <DataTable
        rows={items}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle="Sem itens"
        emptyHint={canEdit ? "Adicione itens acima para enviar o pedido." : "Pedido sem itens."}
      />
    </div>
  );
}
