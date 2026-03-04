"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";
import { PurchaseOrderStatusBadge } from "@/components/erp/status-badge";

async function fetchSuppliers() {
  const res = await fetch("/api/suppliers");
  if (!res.ok) throw new Error("Erro ao carregar fornecedores");
  return res.json();
}

async function fetchPOs() {
  const res = await fetch("/api/purchase-orders");
  if (!res.ok) throw new Error("Erro ao carregar compras");
  return res.json();
}

async function createPO(payload: any) {
  const res = await fetch("/api/purchase-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
  return data;
}

function money(n: any) {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ComprasPedidosPage() {
  const qc = useQueryClient();

  const [supplierId, setSupplierId] = React.useState("");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"ALL" | "DRAFT" | "SENT" | "RECEIVED" | "CANCELED">("ALL");
  const [onlyWithNfe, setOnlyWithNfe] = React.useState(false);

  const { data: supData, isLoading: suppliersLoading } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data, isLoading } = useQuery({ queryKey: ["purchase-orders"], queryFn: fetchPOs });

  const mut = useMutation({
    mutationFn: createPO,
    onSuccess: async (d: { id?: string }) => {
      toast.success("Pedido de compra criado!");
      setSupplierId("");
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      if (d?.id) window.location.href = `/compras/pedidos/${d.id}`;
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao criar pedido"),
  });

  const suppliers = supData?.suppliers ?? [];
  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.purchaseOrders ?? []).filter((po: any) => {
      const s = String(po.status ?? "").toUpperCase();
      if (status !== "ALL" && s !== status) return false;
      if (onlyWithNfe && !po?.nfeKey) return false;

      if (!needle) return true;
      const name = String(po?.supplier?.name ?? "").toLowerCase();
      const id = String(po?.id ?? "").toLowerCase();
      const nfeKey = String(po?.nfeKey ?? "").toLowerCase();
      return name.includes(needle) || id.includes(needle) || nfeKey.includes(needle);
    });
  }, [data?.purchaseOrders, q, status, onlyWithNfe]);

  const columns: Column<any>[] = [
    {
      key: "supplier",
      header: "Fornecedor",
      cell: (po) => (
        <div className="min-w-[260px]">
          <div className="font-medium">{po.supplier?.name ?? "Sem fornecedor"}</div>
          <div className="text-xs text-muted-foreground">ID: {po.id}</div>
        </div>
      ),
    },
    {
      key: "items",
      header: "Itens",
      headerClassName: "w-[90px]",
      className: "text-right tabular-nums",
      cell: (po) => Number(po.itemsCount ?? 0),
    },
    {
      key: "total",
      header: "Total",
      headerClassName: "w-[140px]",
      className: "text-right tabular-nums",
      cell: (po) => money(po.total ?? 0),
    },
    {
      key: "receivedAt",
      header: "Recebido em",
      headerClassName: "w-[160px]",
      cell: (po) =>
        po?.receivedAt
          ? new Date(po.receivedAt).toLocaleDateString("pt-BR")
          : <span className="text-xs text-muted-foreground">—</span>,
    },
    {
      key: "nfe",
      header: "NF-e",
      headerClassName: "w-[160px]",
      cell: (po) =>
        po?.nfeKey ? (
          <span className="font-mono text-xs text-muted-foreground">
            {String(po.nfeKey).slice(0, 10)}…{String(po.nfeKey).slice(-6)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      headerClassName: "w-[140px]",
      cell: (po) => <PurchaseOrderStatusBadge status={po.status} />,
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[180px]",
      className: "text-right",
      cell: (po) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              const ref = po?.nfeKey ? `NFE:${po.nfeKey}` : `PO:${po.id}`;
              window.location.href = `/estoque/movimentacoes?ref=${encodeURIComponent(ref)}`;
            }}
          >
            Ledger
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();
              const ref = po?.nfeKey ? `NFE:${po.nfeKey}` : `PO:${po.id}`;
              try {
                await navigator.clipboard.writeText(ref);
                toast.success("Referência copiada: " + ref);
              } catch {
                toast.error("Não foi possível copiar para a área de transferência.");
              }
            }}
          >
            Copiar ref
          </Button>
          <Link href={`/compras/pedidos/${po.id}`} onClick={(e) => e.stopPropagation()}>
            <Button variant="secondary" size="sm">Abrir</Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Compras"
        subtitle="Pedidos de compra com status, totais e ações. Padrão visual ERP (tabela + filtros + badge)."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/compras/importar-nfe">Importar NF-e (XML)</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/cadastros/fornecedores">Fornecedores</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo pedido de compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Se você já tem a NF-e em XML, pode importar e criar o pedido automaticamente.
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_220px] md:items-center">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={suppliersLoading}
            >
              <option value="">{suppliersLoading ? "Carregando fornecedores..." : "Selecione um fornecedor…"}</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <div className="flex flex-col gap-2 md:flex-row md:justify-end">
              <Button asChild variant="outline" className="w-full md:w-auto">
                <Link href="/compras/importar-nfe">Importar NF-e (XML)</Link>
              </Button>
              <Button
                disabled={!supplierId || mut.isPending}
                onClick={() => mut.mutate({ supplierId })}
                className="w-full md:w-auto"
              >
                {mut.isPending ? "Criando..." : "Criar pedido"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <FiltersShell
        search={q}
        onSearchChange={setQ}
        onClearAll={() => {
          setQ("");
          setStatus("ALL");
        }}
        leftSlot={
          <>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="ALL">Todos os status</option>
              <option value="DRAFT">Rascunho</option>
              <option value="SENT">Enviado</option>
              <option value="RECEIVED">Recebido</option>
              <option value="CANCELED">Cancelado</option>
            </select>

            <div className="text-xs text-muted-foreground ml-1">
              Mostrando {filtered.length} de {(data?.purchaseOrders ?? []).length}
            </div>

            <label className="ml-3 flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={onlyWithNfe}
                onChange={(e) => setOnlyWithNfe(e.target.checked)}
              />
              Somente com NF-e
            </label>
          </>
        }
        rightSlot={
          <Button
            variant="secondary"
            onClick={() => { setQ(""); setStatus("ALL"); setOnlyWithNfe(false); }}
          >
            Limpar filtros
          </Button>
        }
      />

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle={isLoading ? "Carregando..." : "Sem pedidos de compra"}
        emptyHint={isLoading ? "Buscando dados…" : "Crie um pedido acima ou ajuste os filtros."}
        onRowClick={(po) => { window.location.href = `/compras/pedidos/${po.id}`; }}
      />
    </div>
  );
}



