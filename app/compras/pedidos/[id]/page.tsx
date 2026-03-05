"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuditTrail, type AuditRow } from "@/components/erp/audit-trail";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/erp/page-header";
import { PurchaseOrderStatusBadge } from "@/components/erp/status-badge";
import { DataTable, type Column } from "@/components/erp/data-table";

async function fetchAudit(entityId: string) {
  const sp = new URLSearchParams();
  sp.set("entity", "PURCHASE_ORDER");
  sp.set("entityId", entityId);
  sp.set("take", "80");
  const res = await fetch(`/api/audit-logs?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? data.message ?? "Erro ao carregar auditoria");
  return data as { rows: AuditRow[] };
}

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

type ConfirmState = {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void;
};

export default function CompraDetailPage() {
  const params = useParams();
  const id = String((params as any).id);
  const qc = useQueryClient();

  const poQ = useQuery({ queryKey: ["po", id], queryFn: () => fetchPO(id) });
  const matsQ = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });
  const auditQ = useQuery({ queryKey: ["audit", "PURCHASE_ORDER", id], queryFn: () => fetchAudit(id) });

  const po = poQ.data?.purchaseOrder;
  const items = React.useMemo(() => (po?.items ?? []) as any[], [po?.items]);
  const status = String(po?.status ?? "").toUpperCase();

  const [materialId, setMaterialId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [unitCost, setUnitCost] = React.useState(0);

  const [confirm, setConfirm] = React.useState<ConfirmState>({
    open: false,
    title: "",
  });

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
      toast.success("Item adicionado.");
      setMaterialId("");
      setQuantity(1);
      setUnitCost(0);
      await qc.invalidateQueries({ queryKey: ["po", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (itemId: string) => removeItem(itemId),
    onSuccess: async () => {
      toast.success("Item removido.");
      await qc.invalidateQueries({ queryKey: ["po", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const sendMut = useMutation({
    mutationFn: () => markSent(id),
    onSuccess: async () => {
      toast.success("Pedido marcado como ENVIADO.");
      await qc.invalidateQueries({ queryKey: ["po", id] });
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelPO(id),
    onSuccess: async () => {
      toast.success("Pedido CANCELADO.");
      await qc.invalidateQueries({ queryKey: ["po", id] });
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const recMut = useMutation({
    mutationFn: () => receivePO(id),
    onSuccess: async (d: any) => {
      const updatedCosts = d?.updatedCosts ?? [];
      toast.success(
        updatedCosts.length
          ? `Compra recebida! Custos atualizados em ${updatedCosts.length} material(is).`
          : "Compra recebida! Estoque/ledger atualizados."
      );

      await qc.invalidateQueries({ queryKey: ["po", id] });
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.invalidateQueries({ queryKey: ["stock-ledger"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  if (poQ.isLoading) return <div className="p-6">Carregando...</div>;
  if (poQ.error || !po)
    return <div className="p-6">Falha ao carregar o pedido.</div>;

  // Origem NF-e (campos padronizados pela API)
  const nfeKey = (po as any)?.nfeKey ?? (po as any)?.nfe?.key ?? null;
  const nfeIssuedAtRaw = (po as any)?.nfeIssuedAt ?? (po as any)?.nfe?.issuedAt ?? null;
  const nfeIssuedAt = nfeIssuedAtRaw ? new Date(nfeIssuedAtRaw).toLocaleString("pt-BR") : null;

  const supplierLine = [
    po.supplier?.name ?? "-",
    po.supplier?.document ? `Doc: ${po.supplier.document}` : null,
    po.supplier?.phone ? `Tel: ${po.supplier.phone}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const columns: Column<any>[] = [
    {
      key: "material",
      header: "Material",
      cell: (it) => (
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium">
              {it.material?.name ?? it.materialId}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!it.materialId}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!it.materialId) return toast.error("Item sem materialId.");
                  try {
                    await navigator.clipboard.writeText(String(it.materialId));
                    toast.success("MaterialId copiado: " + String(it.materialId));
                  } catch {
                    toast.error("Não foi possível copiar para a área de transferência.");
                  }
                }}
              >
                Copiar materialId
              </Button>
              <Link
                href={`/estoque/movimentacoes?materialId=${encodeURIComponent(String(it.materialId ?? ""))}`}
                onClick={(e) => e.stopPropagation()}
              >
                <Button variant="outline" size="sm" disabled={!it.materialId}>
                  Ledger
                </Button>
              </Link>
            </div>
          </div>
          {it.material?.code ? (
            <div className="text-xs text-muted-foreground">
              Código: {it.material.code}
            </div>
          ) : null}
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
          variant="outline"
          size="sm"
          disabled={!canEdit || delMut.isPending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirm({
              open: true,
              title: "Remover item",
              description: "Tem certeza que deseja remover este item do pedido?",
              confirmText: "Remover",
              cancelText: "Voltar",
              destructive: true,
              onConfirm: () => delMut.mutate(it.id),
            });
          }}
        >
          Remover
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={`Pedido de Compra #${po.id}`}
        subtitle={supplierLine}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <PurchaseOrderStatusBadge status={status as any} />
            <span className="text-sm text-muted-foreground">
              Total: <span className="font-medium text-foreground">{money(total)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              Itens: <span className="font-medium text-foreground">{items.length}</span>
            </span>

            {nfeKey ? (
              <span className="text-sm text-muted-foreground">
                NF-e:{" "}
                <span className="font-mono text-foreground">
                  {String(nfeKey).slice(0, 10)}…{String(nfeKey).slice(-6)}
                </span>
                {nfeIssuedAt ? <span> · {nfeIssuedAt}</span> : null}
              </span>
            ) : null}
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const ref = nfeKey ? `NFE:${nfeKey}` : `PO:${po.id}`;
                window.location.href = `/estoque/movimentacoes?ref=${encodeURIComponent(ref)}`;
              }}
            >
              Ledger
            </Button>
            <Button
              disabled={!canSend || sendMut.isPending}
              onClick={() =>
                setConfirm({
                  open: true,
                  title: "Marcar como ENVIADO",
                  description:
                    "Após enviar, o pedido não poderá mais ser editado. Deseja continuar?",
                  confirmText: "Marcar como Enviado",
                  cancelText: "Voltar",
                  onConfirm: () => sendMut.mutate(),
                })
              }
            >
              {sendMut.isPending ? "Enviando..." : "Marcar como Enviado"}
            </Button>

            <Button
              variant="destructive"
              disabled={!canCancel || cancelMut.isPending}
              onClick={() =>
                setConfirm({
                  open: true,
                  title: "Cancelar pedido de compra",
                  description:
                    "Esta ação marca o pedido como CANCELADO. Deseja continuar?",
                  confirmText: "Cancelar",
                  cancelText: "Voltar",
                  destructive: true,
                  onConfirm: () => cancelMut.mutate(),
                })
              }
            >
              {cancelMut.isPending ? "Cancelando..." : "Cancelar"}
            </Button>

            <Button
              variant="secondary"
              disabled={!canReceive || recMut.isPending}
              onClick={() =>
                setConfirm({
                  open: true,
                  title: "Confirmar RECEBIMENTO",
                  description:
                    "Isso dará entrada no estoque, criará movimentações no ledger e atualizará custos (currentCost) dos materiais. Deseja continuar?",
                  confirmText: "Receber",
                  cancelText: "Voltar",
                  onConfirm: () => recMut.mutate(),
                })
              }
            >
              {recMut.isPending ? "Recebendo..." : "Receber (entrada estoque)"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Adicionar item</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              disabled={!canEdit || matsQ.isLoading}
            >
              <option value="">
                {matsQ.isLoading
                  ? "Carregando materiais..."
                  : "Selecione um material…"}
              </option>
              {(matsQ.data?.materials ?? []).map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.code ? `${m.code} - ` : ""}
                  {m.name}
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
              step="0.0001"
              value={unitCost}
              onChange={(e) => setUnitCost(Number(e.target.value))}
              disabled={!canEdit}
              placeholder="Custo unit."
            />

            <Button
              disabled={!canEdit || addMut.isPending || !materialId}
              onClick={() => addMut.mutate({ materialId, quantity, unitCost })}
            >
              {addMut.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>

          {!canEdit ? (
            <div className="text-xs text-muted-foreground">
              Pedido não está em DRAFT — edição bloqueada.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        rows={items}
        rowKey={(r: any) => r.id}
        emptyTitle="Sem itens"
        emptyHint={
          canEdit ? "Adicione itens acima para enviar o pedido." : "Pedido sem itens."
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Audit Trail</CardTitle>
          <Button
            variant="outline"
            onClick={async () => {
              toast.info("Recarregando auditoria…");
              await qc.invalidateQueries({ queryKey: ["audit", "PURCHASE_ORDER", id] });
            }}
          >
            Recarregar
          </Button>
        </CardHeader>
        <CardContent>
          <AuditTrail
            rows={(auditQ.data?.rows ?? []) as any}
            isLoading={auditQ.isLoading}
            emptyTitle="Sem eventos"
            emptyHint="Quando ações acontecerem (import NF-e, receber, cancelar etc.), elas aparecem aqui."
          />
        </CardContent>
      </Card>

      <Dialog
        open={confirm.open}
        onOpenChange={(v) => setConfirm((c) => ({ ...c, open: v }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm.title}</DialogTitle>
            {confirm.description ? (
              <DialogDescription>{confirm.description}</DialogDescription>
            ) : null}
          </DialogHeader>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirm((c) => ({ ...c, open: false }))}
            >
              {confirm.cancelText ?? "Voltar"}
            </Button>
            <Button
              variant={confirm.destructive ? "destructive" : "default"}
              onClick={() => {
                const fn = confirm.onConfirm;
                setConfirm((c) => ({ ...c, open: false }));
                fn?.();
              }}
            >
              {confirm.confirmText ?? "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
