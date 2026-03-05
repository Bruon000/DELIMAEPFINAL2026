"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/erp/status-badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Row = {
  id: string;
  number: string | null;
  status: string;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  discountPercent?: string | number | null;
  createdAt: string;
  validUntil: string | null;
  client?: { id: string; name: string } | null;
};

function dt(v: any) {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v ?? "");
  return d.toLocaleString("pt-BR");
}
function n(v: any) { return Number(v ?? 0); }
function money(v: any) {
  const x = n(v);
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ptQuoteStatus(s: any) {
  const x = String(s ?? "").toUpperCase();
  const map: Record<string, string> = {
    DRAFT: "Rascunho",
    SENT: "Enviado",
    APPROVED: "Aprovado",
    REJECTED: "Rejeitado",
    EXPIRED: "Vencido",
    CANCELED: "Cancelado",
  };
  return map[x] ?? (x || "—");
}

async function fetchQuotesPage(params: {
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

  const res = await fetch(`/api/quotes?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar orçamentos");
  return data as { ok: boolean; rows: Row[]; nextCursor: string | null };
}

async function convertToOrder(quoteId: string) {
  const res = await fetch(`/api/quotes/${quoteId}/convert-to-order`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao converter para pedido");
  return data as { ok: boolean; orderId: string };
}

async function setDiscount(quoteId: string, discountPercent: number) {
  const res = await fetch(`/api/quotes/${quoteId}/set-discount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ discountPercent }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao aplicar desconto");
  return data;
}

async function requestDiscount(quoteId: string, requestedPercent: number, reason: string) {
  const res = await fetch(`/api/quotes/${quoteId}/discount-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestedPercent, reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao solicitar desconto");
  return data;
}

export default function ComercialOrcamentosPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const role = String((session as any)?.user?.role ?? "");

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>("ALL");
  const [mine, setMine] = React.useState<boolean>(true);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const [discOpen, setDiscOpen] = React.useState(false);
  const [discQuoteId, setDiscQuoteId] = React.useState<string | null>(null);
  const [discPct, setDiscPct] = React.useState("5");
  const [discReason, setDiscReason] = React.useState("");

  const queryKey = React.useMemo(
    () => ["quotes", { q, status, mine, from, to }],
    [q, status, mine, from, to],
  );

  const listQ = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchQuotesPage({
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

  const convertMut = useMutation({
    mutationFn: convertToOrder,
    onSuccess: async (d) => {
      toast.success("Convertido para pedido!");
      await qc.invalidateQueries({ queryKey: ["quotes"] });
      window.location.href = `/pedidos/${(d as any).orderId}`;
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao converter"),
  });

  const discMut = useMutation({
    mutationFn: async () => {
      const pct = Number(discPct ?? 0);
      if (!discQuoteId) throw new Error("quoteId inválido");
      if (pct <= 5) return setDiscount(discQuoteId, pct);
      return requestDiscount(discQuoteId, pct, discReason.trim());
    },
    onSuccess: async () => {
      const pct = Number(discPct ?? 0);
      toast.success(pct <= 5 ? "Desconto aplicado." : "Solicitação enviada para o Admin.");
      setDiscOpen(false);
      setDiscQuoteId(null);
      setDiscReason("");
      await qc.invalidateQueries({ queryKey: ["quotes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const columns: Column<Row>[] = [
    {
      key: "createdAt",
      header: "Criado",
      headerClassName: "w-[190px]",
      cell: (r) => <div className="tabular-nums">{dt(r.createdAt)}</div>,
    },
    {
      key: "quote",
      header: "Orçamento",
      cell: (r) => (
        <div className="min-w-[340px]">
          <div className="font-medium">{r.number ? `Orç. ${r.number}` : r.id}</div>
          <div className="text-xs text-muted-foreground">{r.client?.name ?? "Sem cliente"}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      headerClassName: "w-[160px]",
      cell: (r) => <StatusBadge label={ptQuoteStatus(r.status)} />,
    },
    {
      key: "total",
      header: "Total",
      headerClassName: "w-[150px]",
      className: "text-right tabular-nums",
      cell: (r) => money(r.total),
    },
    {
      key: "discount",
      header: "Desc.",
      headerClassName: "w-[110px]",
      className: "text-right tabular-nums",
      cell: (r) => `${Number((r as any).discountPercent ?? 0).toFixed(2)}%`,
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[300px]",
      className: "text-right",
      cell: (r) => {
        const canConvert = String(r.status).toUpperCase() !== "CANCELED";
        return (
          <div className="flex justify-end gap-2">
            <Link href={`/orcamentos/${r.id}`} onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="secondary">Abrir</Button>
            </Link>
            {role === "VENDEDOR" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setDiscQuoteId(r.id);
                  setDiscPct("5");
                  setDiscReason("");
                  setDiscOpen(true);
                }}
              >
                Desconto
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={!canConvert || convertMut.isPending}
              onClick={(e) => {
                e.stopPropagation();
                convertMut.mutate(r.id);
              }}
            >
              {convertMut.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Convertendo…
                </span>
              ) : "Converter p/ pedido"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Comercial — Orçamentos"
        subtitle="Lista do vendedor (filtros, status e conversão para pedido)."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => listQ.refetch()}>Recarregar</Button>
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
              <option value="SENT">SENT</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CANCELED">CANCELED</option>
            </select>

            <label className="flex items-center gap-2 text-sm px-2">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
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
        emptyTitle={listQ.isLoading ? "Carregando..." : "Sem orçamentos"}
        emptyHint={listQ.isLoading ? "Buscando…" : "Ajuste filtros."}
      />

      <Dialog open={discOpen} onOpenChange={setDiscOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Desconto</DialogTitle>
            <DialogDescription>
              Até 5% o vendedor aplica direto. Acima disso, vira solicitação para o Admin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Percentual (%)</Label>
              <Input type="number" value={discPct} onChange={(e) => setDiscPct(e.target.value)} />
            </div>
            {Number(discPct ?? 0) > 5 ? (
              <div className="space-y-1">
                <Label>Motivo (obrigatório acima de 5%)</Label>
                <Input value={discReason} onChange={(e) => setDiscReason(e.target.value)} placeholder="Ex.: concorrência / cliente antigo / volume..." />
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDiscOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => discMut.mutate()}
              disabled={discMut.isPending || !discQuoteId || (Number(discPct ?? 0) > 5 && discReason.trim().length < 3)}
            >
              {discMut.isPending ? "Enviando..." : (Number(discPct ?? 0) <= 5 ? "Aplicar" : "Solicitar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
