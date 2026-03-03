"use client";

import * as React from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";

type LedgerRow = {
  id: string;
  materialId: string;
  type: string;
  quantity: string | number;
  balance: string | number;
  reference: string | null;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
  material?: { id: string; name: string; code: string | null } | null;
};

function dt(v: any) {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v ?? "");
  return d.toLocaleString("pt-BR");
}

function n(v: any) {
  return Number(v ?? 0);
}

async function fetchLedgerPage(params: {
  q?: string;
  materialId?: string;
  type?: string;
  from?: string;
  to?: string;
  take?: number;
  cursor?: string | null;
}) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.materialId) sp.set("materialId", params.materialId);
  if (params.type && params.type !== "ALL") sp.set("type", params.type);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  sp.set("take", String(params.take ?? 30));
  if (params.cursor) sp.set("cursor", params.cursor);

  const res = await fetch(`/api/stock/ledger?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar razão");
  return data as { ok: boolean; rows: LedgerRow[]; nextCursor: string | null };
}

async function postIssue(payload: {
  materialId: string;
  quantity: number;
  reason?: string;
  reference?: string;
  note?: string;
}) {
  const res = await fetch("/api/stock/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao dar saída");
  return data;
}

async function postInventoryAdjust(payload: {
  materialId: string;
  newQuantity: number;
  reference?: string;
  note?: string;
}) {
  const res = await fetch("/api/stock/inventory-adjust", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao ajustar inventário");
  return data;
}

export default function EstoqueMovimentacoesPage() {
  const qc = useQueryClient();

  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<"ALL" | string>("ALL");
  const [materialId, setMaterialId] = React.useState("");
  const [from, setFrom] = React.useState(""); // YYYY-MM-DD
  const [to, setTo] = React.useState(""); // YYYY-MM-DD

  const [issueOpen, setIssueOpen] = React.useState(false);
  const [adjustOpen, setAdjustOpen] = React.useState(false);

  const [issueMaterialId, setIssueMaterialId] = React.useState("");
  const [issueQty, setIssueQty] = React.useState("1");
  const [issueReason, setIssueReason] = React.useState("perda");
  const [issueRef, setIssueRef] = React.useState("");
  const [issueNote, setIssueNote] = React.useState("");

  const [adjMaterialId, setAdjMaterialId] = React.useState("");
  const [adjNewQty, setAdjNewQty] = React.useState("0");
  const [adjRef, setAdjRef] = React.useState("");
  const [adjNote, setAdjNote] = React.useState("");

  const queryKey = React.useMemo(
    () => ["stock-ledger", { q, type, materialId, from, to }],
    [q, type, materialId, from, to],
  );

  const ledgerQ = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchLedgerPage({
        q: q.trim() || undefined,
        type,
        materialId: materialId.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        take: 30,
        cursor: pageParam ?? null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextCursor ?? null,
  });

  const rows = React.useMemo(() => {
    const pages = ledgerQ.data?.pages ?? [];
    return pages.flatMap((p) => p?.rows ?? []);
  }, [ledgerQ.data]);

  const issueMut = useMutation({
    mutationFn: postIssue,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-ledger"] });
      setIssueOpen(false);
      // refresh current query
      await qc.invalidateQueries({ queryKey });
    },
  });

  const adjustMut = useMutation({
    mutationFn: postInventoryAdjust,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["stock-ledger"] });
      setAdjustOpen(false);
      await qc.invalidateQueries({ queryKey });
    },
  });

  const columns: Column<LedgerRow>[] = [
    {
      key: "createdAt",
      header: "Data",
      headerClassName: "w-[190px]",
      cell: (r) => <div className="tabular-nums">{dt(r.createdAt)}</div>,
    },
    {
      key: "material",
      header: "Material",
      cell: (r) => (
        <div className="min-w-[320px]">
          <div className="font-medium">{r.material?.name ?? r.materialId}</div>
          <div className="text-xs text-muted-foreground">
            {r.material?.code ? `Código: ${r.material.code} · ` : null}
            ID: {r.materialId}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      headerClassName: "w-[140px]",
      cell: (r) => String(r.type ?? ""),
    },
    {
      key: "qty",
      header: "Qtd",
      headerClassName: "w-[90px]",
      className: "text-right tabular-nums",
      cell: (r) => n(r.quantity),
    },
    {
      key: "balance",
      header: "Saldo",
      headerClassName: "w-[90px]",
      className: "text-right tabular-nums",
      cell: (r) => n(r.balance),
    },
    {
      key: "ref",
      header: "Referência / Nota",
      cell: (r) => (
        <div className="min-w-[320px]">
          <div className="text-sm">{r.reference ?? "-"}</div>
          <div className="text-xs text-muted-foreground">{r.note ?? ""}</div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[140px]",
      className: "text-right",
      cell: (r) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setIssueMaterialId(r.materialId);
            setIssueQty("1");
            setIssueReason("perda");
            setIssueRef(r.reference ?? "");
            setIssueNote("");
            setIssueOpen(true);
          }}
        >
          Saída
        </Button>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Movimentações de Estoque"
        subtitle="Razão de estoque com filtros, busca e ações rápidas (saída e ajuste)."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setAdjMaterialId(materialId.trim());
                setAdjNewQty("0");
                setAdjRef("INVENTARIO");
                setAdjNote("");
                setAdjustOpen(true);
              }}
            >
              Ajuste inventário
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setIssueMaterialId(materialId.trim());
                setIssueQty("1");
                setIssueReason("perda");
                setIssueRef("");
                setIssueNote("");
                setIssueOpen(true);
              }}
            >
              Saída manual
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FiltersShell
            search={q}
            onSearchChange={setQ}
            onClearAll={() => {
              setQ("");
              setType("ALL");
              setMaterialId("");
              setFrom("");
              setTo("");
            }}
            leftSlot={
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="ALL">Todos</option>
                  <option value="RECEIVED">RECEIVED</option>
                  <option value="ISSUED">ISSUED</option>
                  <option value="ADJUSTMENT">ADJUSTMENT</option>
                </select>

                <Input
                  className="h-10 w-[320px]"
                  placeholder="Filtrar por materialId (opcional)"
                  value={materialId}
                  onChange={(e) => setMaterialId(e.target.value)}
                />

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input className="h-10 w-[160px]" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input className="h-10 w-[160px]" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>

                <div className="text-xs text-muted-foreground ml-1">
                  {ledgerQ.isFetching ? "Atualizando…" : `Itens: ${rows.length}`}
                </div>
              </div>
            }
            rightSlot={
              <Button variant="secondary" onClick={() => ledgerQ.refetch()}>
                Recarregar
              </Button>
            }
          />
        </CardContent>
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle={ledgerQ.isLoading ? "Carregando..." : "Sem movimentações"}
        emptyHint={ledgerQ.isLoading ? "Buscando dados…" : "Ajuste filtros ou faça uma movimentação (entrada/saída/ajuste)."}
      />

      <div className="flex justify-center">
        <Button
          variant="secondary"
          disabled={!ledgerQ.hasNextPage || ledgerQ.isFetchingNextPage}
          onClick={() => ledgerQ.fetchNextPage()}
        >
          {ledgerQ.isFetchingNextPage ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </span>
          ) : ledgerQ.hasNextPage ? "Carregar mais" : "Fim"}
        </Button>
      </div>

      {/* Modal Saída */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Saída manual (ISSUED)</DialogTitle>
            <DialogDescription>Registra uma saída do estoque e grava no ledger com auditoria.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Material ID</Label>
              <Input value={issueMaterialId} onChange={(e) => setIssueMaterialId(e.target.value)} placeholder="materialId" />
            </div>
            <div className="grid gap-1">
              <Label>Quantidade</Label>
              <Input value={issueQty} onChange={(e) => setIssueQty(e.target.value)} inputMode="decimal" />
            </div>
            <div className="grid gap-1">
              <Label>Motivo</Label>
              <Input value={issueReason} onChange={(e) => setIssueReason(e.target.value)} placeholder="perda / consumo / ajuste" />
            </div>
            <div className="grid gap-1">
              <Label>Referência (opcional)</Label>
              <Input value={issueRef} onChange={(e) => setIssueRef(e.target.value)} placeholder="OP:..., OS:..., NFE:..." />
            </div>
            <div className="grid gap-1">
              <Label>Nota (opcional)</Label>
              <Input value={issueNote} onChange={(e) => setIssueNote(e.target.value)} placeholder="Observação" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setIssueOpen(false)} disabled={issueMut.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const qty = Number(issueQty);
                issueMut.mutate({
                  materialId: issueMaterialId.trim(),
                  quantity: Number.isFinite(qty) ? qty : 0,
                  reason: issueReason.trim() || undefined,
                  reference: issueRef.trim() || undefined,
                  note: issueNote.trim() || undefined,
                });
              }}
              disabled={issueMut.isPending || !issueMaterialId.trim()}
            >
              {issueMut.isPending ? "Salvando..." : "Confirmar saída"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Ajuste */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajuste de inventário (ADJUSTMENT)</DialogTitle>
            <DialogDescription>Define o saldo final do item (não permite ficar abaixo do reservado).</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Material ID</Label>
              <Input value={adjMaterialId} onChange={(e) => setAdjMaterialId(e.target.value)} placeholder="materialId" />
            </div>
            <div className="grid gap-1">
              <Label>Novo saldo</Label>
              <Input value={adjNewQty} onChange={(e) => setAdjNewQty(e.target.value)} inputMode="decimal" />
            </div>
            <div className="grid gap-1">
              <Label>Referência (opcional)</Label>
              <Input value={adjRef} onChange={(e) => setAdjRef(e.target.value)} placeholder="INVENTARIO / CONTAGEM / ..." />
            </div>
            <div className="grid gap-1">
              <Label>Nota (opcional)</Label>
              <Input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="Observação" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setAdjustOpen(false)} disabled={adjustMut.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const nq = Number(adjNewQty);
                adjustMut.mutate({
                  materialId: adjMaterialId.trim(),
                  newQuantity: Number.isFinite(nq) ? nq : 0,
                  reference: adjRef.trim() || undefined,
                  note: adjNote.trim() || undefined,
                });
              }}
              disabled={adjustMut.isPending || !adjMaterialId.trim()}
            >
              {adjustMut.isPending ? "Salvando..." : "Confirmar ajuste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
