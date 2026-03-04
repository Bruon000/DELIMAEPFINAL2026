"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

async function fetchSession() {
  const res = await fetch("/api/cash/session");
  if (!res.ok) throw new Error("Erro ao carregar sessão");
  return res.json();
}

async function fetchTransactions(params: { q?: string; type?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.type && params.type !== "ALL") sp.set("type", params.type);
  const res = await fetch(`/api/cash/transactions?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar transações");
  return data as { sessionId: string | null; transactions: any[] };
}

async function openCash(openingBalance: number) {
  const res = await fetch("/api/cash/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openingBalance }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao abrir");
  return data;
}

async function closeCash(closingBalance: number) {
  const res = await fetch("/api/cash/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ closingBalance }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao fechar");
  return data;
}

async function postTransaction(payload: { type: "IN" | "OUT"; amount: number; description?: string; reference?: string }) {
  const res = await fetch("/api/cash/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Erro ao lançar transação");
  return data;
}

export default function CaixaPage() {
  const qc = useQueryClient();
  const { data: sessData, isLoading: sessLoading } = useQuery({ queryKey: ["cash-session"], queryFn: fetchSession });

  const cashSession = sessData?.cashSession;

  const [q, setQ] = React.useState("");
  const [txType, setTxType] = React.useState<"ALL" | "IN" | "OUT">("ALL");

  const txQ = useQuery({
    queryKey: ["cash-transactions", { q, txType }],
    queryFn: () => fetchTransactions({ q: q.trim() || undefined, type: txType }),
  });

  const txs = txQ.data?.transactions ?? [];

  const [openingBalance, setOpeningBalance] = React.useState(0);
  const [closingBalance, setClosingBalance] = React.useState(0);

  const [txOpen, setTxOpen] = React.useState(false);
  const [newType, setNewType] = React.useState<"IN" | "OUT">("IN");
  const [newAmount, setNewAmount] = React.useState("0");
  const [newDesc, setNewDesc] = React.useState("");
  const [newRef, setNewRef] = React.useState("");

  const openMut = useMutation({
    mutationFn: () => openCash(openingBalance),
    onSuccess: async () => {
      toast.success("Caixa aberto.");
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
      await qc.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const closeMut = useMutation({
    mutationFn: () => closeCash(closingBalance),
    onSuccess: async () => {
      toast.success("Caixa fechado.");
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
      await qc.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const txMut = useMutation({
    mutationFn: () =>
      postTransaction({
        type: newType,
        amount: Number(newAmount ?? 0),
        description: newDesc.trim() || undefined,
        reference: newRef.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success("Transação registrada.");
      setTxOpen(false);
      setNewAmount("0");
      setNewDesc("");
      setNewRef("");
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
      await qc.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao lançar transação"),
  });

  const sumIn = txs.filter((t: any) => t.type === "IN").reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);
  const sumOut = txs.filter((t: any) => t.type === "OUT").reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);
  const movement = sumIn - sumOut;

  const columns: Column<any>[] = [
    {
      key: "createdAt",
      header: "Data",
      headerClassName: "w-[190px]",
      cell: (t) => <div className="tabular-nums">{new Date(t.createdAt).toLocaleString("pt-BR")}</div>,
    },
    {
      key: "type",
      header: "Tipo",
      headerClassName: "w-[90px]",
      cell: (t) => <span className="font-medium">{t.type}</span>,
    },
    {
      key: "amount",
      header: "Valor",
      headerClassName: "w-[140px]",
      className: "text-right tabular-nums",
      cell: (t) => `R$ ${Number(t.amount ?? 0).toFixed(2)}`,
    },
    {
      key: "desc",
      header: "Descrição / Ref",
      cell: (t) => (
        <div className="min-w-[320px]">
          <div className="text-sm font-medium">{t.description ?? "-"}</div>
          <div className="text-xs text-muted-foreground">{t.reference ? `Ref: ${t.reference}` : ""}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Caixa"
        subtitle="Abertura/fechamento e lançamentos manuais."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (!cashSession) return toast.error("Abra o caixa antes de lançar transações.");
                setTxOpen(true);
              }}
            >
              Nova transação
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader><CardTitle>Sessão</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {sessLoading && <p>Carregando...</p>}

          {!cashSession ? (
            <div className="space-y-2">
              <p className="text-muted-foreground">Nenhuma sessão aberta.</p>
              <div className="flex gap-2 items-center">
                <Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(Number(e.target.value))} />
                <Button onClick={() => openMut.mutate()} disabled={openMut.isPending}>
                  {openMut.isPending ? "Abrindo..." : "Abrir caixa"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div><b>Aberto em:</b> {new Date(cashSession.openedAt).toLocaleString()}</div>
              <div><b>Saldo inicial:</b> {Number(cashSession.openingBalance ?? 0).toFixed(2)}</div>
              <div><b>Movimento:</b> {Number(movement).toFixed(2)} (IN {sumIn.toFixed(2)} / OUT {sumOut.toFixed(2)})</div>

              <div className="flex gap-2 items-center">
                <Input type="number" value={closingBalance} onChange={(e) => setClosingBalance(Number(e.target.value))} />
                <Button onClick={() => closeMut.mutate()} disabled={closeMut.isPending}>
                  {closeMut.isPending ? "Fechando..." : "Fechar caixa"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Transações</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <FiltersShell
            search={q}
            onSearchChange={setQ}
            onClearAll={() => {
              setQ("");
              setTxType("ALL");
            }}
            leftSlot={
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={txType}
                onChange={(e) => setTxType(e.target.value as any)}
              >
                <option value="ALL">Todos</option>
                <option value="IN">Entradas (IN)</option>
                <option value="OUT">Saídas (OUT)</option>
              </select>
            }
            rightSlot={
              <Button variant="secondary" onClick={() => { setQ(""); setTxType("ALL"); }}>
                Limpar filtros
              </Button>
            }
          />

          <DataTable
            rows={txs}
            columns={columns}
            rowKey={(r) => r.id}
            emptyTitle={txQ.isLoading ? "Carregando..." : "Sem transações"}
            emptyHint={txQ.isLoading ? "Buscando dados…" : "Lance uma transação manual para registrar entradas/saídas."}
          />
        </CardContent>
      </Card>

      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova transação</DialogTitle>
            <DialogDescription>
              Lançamento manual no caixa (IN/OUT). Requer caixa aberto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={newType}
                onChange={(e) => setNewType(e.target.value as any)}
              >
                <option value="IN">IN (Entrada)</option>
                <option value="OUT">OUT (Saída)</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>Valor</Label>
              <Input type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Ex.: Troco / Pagamento fornecedor" />
            </div>

            <div className="space-y-1">
              <Label>Referência (opcional)</Label>
              <Input value={newRef} onChange={(e) => setNewRef(e.target.value)} placeholder="Ex.: PO:123 / NFE:..." />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTxOpen(false)}>Cancelar</Button>
            <Button onClick={() => txMut.mutate()} disabled={txMut.isPending}>
              {txMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
