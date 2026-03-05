"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";
import { OrderStatusBadge } from "@/components/erp/status-badge";

type Row = {
  id: string;
  number: string | null;
  status: string;
  total: string | number;
  discount: string | number | null;
  subtotal: string | number | null;
  createdAt: string;
  confirmedAt: string | null;
  client?: { id: string; name: string } | null;
};

function dt(v: any) {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v ?? "");
  return d.toLocaleString("pt-BR");
}
function n(v: any) {
  return Number(v ?? 0);
}
function money(v: any) {
  const x = n(v);
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ptOrderStatus(s: any) {
  const x = String(s ?? "").toUpperCase();
  const map: Record<string, string> = {
    DRAFT: "Rascunho",
    OPEN: "Aberto",
    CONFIRMED: "Confirmado",
    IN_PRODUCTION: "Em produção",
    READY: "Pronto",
    DELIVERED: "Entregue",
    CANCELED: "Cancelado",
  };
  return (map[x] ?? x) || "—";
}

async function fetchOrdersPage(params: {
  q?: string;
  status?: string;
  mine?: boolean;
  from?: string;
  to?: string;
  take?: number;
  cursor?: string | null;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status && params.status !== "ALL") sp.set("status", params.status);
  if (params.mine) sp.set("mine", "1");
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  sp.set("take", String(params.take ?? 30));
  if (params.cursor) sp.set("cursor", params.cursor);

  const res = await fetch(`/api/commercial/orders?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar pedidos");
  return data as { ok: boolean; rows: Row[]; nextCursor: string | null };
}

async function confirmOrder(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}/confirm`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      res.status === 401
        ? "Sessão expirada, faça login novamente."
        : (data?.message ?? data?.error ?? "Erro ao confirmar pedido");
    throw new Error(msg);
  }
  return data as { ok: boolean; productionOrderId?: string; accountsReceivableId?: string; total?: number };
}

export default function ComercialPedidosPage() {
  const qc = useQueryClient();

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>("ALL");
  const [mine, setMine] = React.useState<boolean>(true);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const queryKey = React.useMemo(
    () => ["commercial-orders", { q, status, mine, from, to }],
    [q, status, mine, from, to],
  );

  const listQ = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchOrdersPage({
        q: q.trim() || undefined,
        status,
        mine,
        from: from || undefined,
        to: to || undefined,
        take: 30,
        cursor: pageParam ?? null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextCursor ?? null,
  });

  const rows = React.useMemo(() => {
    const pages = listQ.data?.pages ?? [];
    return pages.flatMap((p) => p?.rows ?? []);
  }, [listQ.data]);

  const confirmMut = useMutation({
    mutationFn: confirmOrder,
    onSuccess: async (d, orderId) => {
      toast.success("Pedido confirmado! Conta a receber (AR) gerada para o Caixa.");
      await qc.invalidateQueries({ queryKey: ["commercial-orders"] });
      await qc.invalidateQueries({ queryKey });

      const arId = (d as any)?.accountsReceivableId ?? null;
      if (arId) {
        const ref = `AR:${arId}`;
        try {
          await navigator.clipboard.writeText(ref);
          toast.success("Ref do Caixa copiada: " + ref);
        } catch {
          toast.message("Ref do Caixa: " + ref);
        }
      } else {
        toast.message("Dica: Abra o pedido e gere/visualize o recebimento no Caixa.");
      }

      // VENDEDOR não deve ir para Produção (RBAC bloqueia /producao)
      window.location.href = `/pedidos/${orderId}`;
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao confirmar pedido"),
  });

  const columns: Column<Row>[] = [
    {
      key: "createdAt",
      header: "Criado",
      headerClassName: "w-[190px]",
      cell: (r) => <div className="tabular-nums">{dt(r.createdAt)}</div>,
    },
    {
      key: "order",
      header: "Pedido",
      cell: (r) => (
        <div className="min-w-[320px]">
          <div className="font-medium">{r.number ? `Pedido ${r.number}` : r.id}</div>
          <div className="text-xs text-muted-foreground">{r.client?.name ?? "Sem cliente"}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      headerClassName: "w-[160px]",
      cell: (r) => (
        <OrderStatusBadge status={ptOrderStatus(r.status)} />
      ),
    },
    {
      key: "total",
      header: "Total",
      headerClassName: "w-[150px]",
      className: "text-right tabular-nums",
      cell: (r) => money(r.total),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[240px]",
      className: "text-right",
      cell: (r) => {
        const canConfirm = String(r.status) === "DRAFT";
        return (
          <div className="flex justify-end gap-2">
            <Link href={`/pedidos/${r.id}`} onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="secondary">Abrir</Button>
            </Link>
            <Button
              size="sm"
              disabled={!canConfirm || confirmMut.isPending}
              onClick={(e) => {
                e.stopPropagation();
                confirmMut.mutate(r.id);
              }}
            >
              {confirmMut.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Confirmando…
                </span>
              ) : "Confirmar"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Comercial — Pedidos"
        subtitle="Lista de pedidos para o vendedor (filtros, status e ação rápida de confirmar)."
        actions={
          <div className="flex gap-2">
            <Link href="/pedidos/novo">
              <Button>Novo pedido</Button>
            </Link>
            <Button variant="secondary" onClick={() => listQ.refetch()}>
              Recarregar
            </Button>
          </div>
        }
      />

      <FiltersShell
        search={q}
        onSearchChange={setQ}
        onClearAll={() => {
          setQ("");
          setStatus("ALL");
          setMine(true);
          setFrom("");
          setTo("");
        }}
        leftSlot={
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ALL">Todos</option>
              <option value="DRAFT">DRAFT</option>
              <option value="OPEN">OPEN</option>
              <option value="CONFIRMED">CONFIRMED</option>
              <option value="IN_PRODUCTION">IN_PRODUCTION</option>
              <option value="READY">READY</option>
              <option value="DELIVERED">DELIVERED</option>
              <option value="CANCELED">CANCELED</option>
            </select>

            <label className="flex items-center gap-2 text-sm px-2">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => setMine(e.target.checked)}
              />
              Só meus
            </label>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input className="h-10 w-[160px]" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input className="h-10 w-[160px]" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>

            <div className="text-xs text-muted-foreground ml-1">
              {listQ.isFetching ? "Atualizando…" : `Itens: ${rows.length}`}
            </div>
          </div>
        }
        rightSlot={null}
      />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle={listQ.isLoading ? "Carregando..." : "Sem pedidos"}
        emptyHint={listQ.isLoading ? "Buscando pedidos…" : "Ajuste filtros ou crie um novo pedido."}
      />

      <div className="flex justify-center">
        <Button
          variant="secondary"
          disabled={!listQ.hasNextPage || listQ.isFetchingNextPage}
          onClick={() => listQ.fetchNextPage()}
        >
          {listQ.isFetchingNextPage ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </span>
          ) : listQ.hasNextPage ? "Carregar mais" : "Fim"}
        </Button>
      </div>
    </div>
  );
}

