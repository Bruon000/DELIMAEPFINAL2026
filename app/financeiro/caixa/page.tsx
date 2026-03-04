"use client";

import * as React from "react";
import Link from "next/link";
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

async function fetchTransactions(params: { q?: string; type?: string; from?: string; to?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.type && params.type !== "ALL") sp.set("type", params.type);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
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

async function closeCashConfirmed(closingBalance: number) {
  const res = await fetch("/api/cash/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ closingBalance, confirm: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Erro ao fechar");
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
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const txQ = useQuery({
    queryKey: ["cash-transactions", { q, txType, from, to }],
    queryFn: () => fetchTransactions({ q: q.trim() || undefined, type: txType, from: from || undefined, to: to || undefined }),
  });

  const txs = txQ.data?.transactions ?? [];

  const [openingBalance, setOpeningBalance] = React.useState(0);
  const [closingBalance, setClosingBalance] = React.useState(0);

  const [closeConfirmOpen, setCloseConfirmOpen] = React.useState(false);
  const [closeMismatch, setCloseMismatch] = React.useState<any>(null);

  const [txOpen, setTxOpen] = React.useState(false);
  const [newType, setNewType] = React.useState<"IN" | "OUT">("IN");
  const [newAmount, setNewAmount] = React.useState("0");
  const [newDesc, setNewDesc] = React.useState("");
  const [newRef, setNewRef] = React.useState("");

  const [outOpen, setOutOpen] = React.useState(false);
  const [outAmount, setOutAmount] = React.useState("0");
  const [outReason, setOutReason] = React.useState("");
  const [outRef, setOutRef] = React.useState("");

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
    onError: (e: any) => {
      const msg = e?.message ?? "Erro";
      // Se a API retornou 409, o fetch acima lançou só "closing_balance_mismatch".
      // Vamos tentar repetir chamando /api/cash/close e capturar corpo:
      toast.error(msg);
    },
  });

  const closeConfirmMut = useMutation({
    mutationFn: () => closeCashConfirmed(closingBalance),
    onSuccess: async () => {
      toast.success("Caixa fechado (confirmado).");
      setCloseConfirmOpen(false);
      setCloseMismatch(null);
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
      await qc.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao fechar"),
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

  const outMut = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cash/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "OUT",
          amount: Number(outAmount ?? 0),
          reason: outReason.trim() || undefined,
          reference: outRef.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao registrar saída");
      return data;
    },
    onSuccess: async () => {
      toast.success("Saída registrada (OUT).");
      setOutOpen(false);
      setOutAmount("0");
      setOutReason("");
      setOutRef("");
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
      await qc.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar saída"),
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {t.reference ? <span>{`Ref: ${t.reference}`}</span> : null}
            {t.reference && String(t.reference).startsWith("AP:") ? (
              <Link
                href={`/financeiro/contas-pagar?q=${encodeURIComponent(String(t.reference).slice(3))}`}
                onClick={(e) => e.stopPropagation()}
                className="underline"
              >
                Abrir
              </Link>
            ) : null}
          </div>
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
            <Button
              variant="outline"
              onClick={() => {
                if (!cashSession) return toast.error("Abra o caixa antes de lançar transações.");
                setOutOpen(true);
              }}
            >
              Saída manual
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
                <Button
                  onClick={async () => {
                    try {
                      await closeMut.mutateAsync();
                    } catch {
                      // Re-faz a chamada para capturar o corpo do 409 e abrir o dialog
                      const res = await fetch("/api/cash/close", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ closingBalance }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.status === 409 && data?.error === "closing_balance_mismatch") {
                        setCloseMismatch(data);
                        setCloseConfirmOpen(true);
                        return;
                      }
                      toast.error(data?.message ?? data?.error ?? "Erro ao fechar");
                    }
                  }}
                  disabled={closeMut.isPending}
                >
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
              setFrom("");
              setTo("");
            }}
            leftSlot={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as any)}
                >
                  <option value="ALL">Todos</option>
                  <option value="IN">Entradas (IN)</option>
                  <option value="OUT">Saídas (OUT)</option>
                </select>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[160px]" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[160px]" />
              </div>
            }
            rightSlot={
              <Button variant="secondary" onClick={() => { setQ(""); setTxType("ALL"); setFrom(""); setTo(""); }}>
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

      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar fechamento</DialogTitle>
            <DialogDescription>
              O saldo informado diverge do saldo esperado. Confirme se deseja fechar mesmo assim.
            </DialogDescription>
          </DialogHeader>

          {closeMismatch ? (
            <div className="text-sm space-y-1">
              <div><b>Esperado:</b> R$ {Number(closeMismatch.expectedBalance ?? 0).toFixed(2)}</div>
              <div><b>Informado:</b> R$ {Number(closeMismatch.closingBalance ?? 0).toFixed(2)}</div>
              <div><b>Diferença:</b> R$ {Number(closeMismatch.delta ?? 0).toFixed(2)}</div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseConfirmOpen(false)}>Cancelar</Button>
            <Button onClick={() => closeConfirmMut.mutate()} disabled={closeConfirmMut.isPending}>
              {closeConfirmMut.isPending ? "Fechando..." : "Confirmar e fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={outOpen} onOpenChange={setOutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Saída manual (OUT)</DialogTitle>
            <DialogDescription>
              Registra uma saída no caixa com motivo (fica em descrição como “Motivo: ...”).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Valor</Label>
              <Input type="number" value={outAmount} onChange={(e) => setOutAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Input value={outReason} onChange={(e) => setOutReason(e.target.value)} placeholder="Ex.: combustível, entrega, material, taxa..." />
            </div>
            <div className="space-y-1">
              <Label>Referência (opcional)</Label>
              <Input value={outRef} onChange={(e) => setOutRef(e.target.value)} placeholder="Ex.: AP:..., PO:..., NFE:..." />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOutOpen(false)}>Cancelar</Button>
            <Button onClick={() => outMut.mutate()} disabled={outMut.isPending}>
              {outMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
