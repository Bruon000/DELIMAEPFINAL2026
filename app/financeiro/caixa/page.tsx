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

async function fetchAR(params: { q?: string; status?: string }) {
  const sp = new URLSearchParams();
  sp.set("status", params.status ?? "PENDING");
  if (params.q) sp.set("q", params.q);
  const res = await fetch(`/api/accounts-receivable?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Erro ao carregar contas a receber");
  return data as { ars: any[] };
}

async function receiveAR(payload: { accountsReceivableId: string; note?: string }) {
  const res = await fetch("/api/cash/receive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao receber");
  return data;
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

async function fetchClosedSessions() {
  const res = await fetch("/api/cash/sessions?closed=true");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar sessões fechadas");
  return data as { sessions: any[] };
}

async function fetchSessionDetail(id: string) {
  const res = await fetch(`/api/cash/sessions/${id}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Sessão não encontrada");
  return data as { session: any; transactions: any[] };
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
  const [closedSessionsOpen, setClosedSessionsOpen] = React.useState(false);
  const [detailSessionId, setDetailSessionId] = React.useState<string | null>(null);

  const txQ = useQuery({
    queryKey: ["cash-transactions", { q, txType, from, to }],
    queryFn: () => fetchTransactions({ q: q.trim() || undefined, type: txType, from: from || undefined, to: to || undefined }),
  });

  const closedSessionsQ = useQuery({
    queryKey: ["cash-sessions-closed"],
    queryFn: fetchClosedSessions,
    enabled: closedSessionsOpen,
  });
  const closedSessions = closedSessionsQ.data?.sessions ?? [];

  const sessionDetailQ = useQuery({
    queryKey: ["cash-session-detail", detailSessionId],
    queryFn: () => fetchSessionDetail(detailSessionId!),
    enabled: !!detailSessionId,
  });
  const sessionDetail = sessionDetailQ.data;

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

  const [recvOpen, setRecvOpen] = React.useState(false);
  const [arQ, setArQ] = React.useState("");
  const [recvNote, setRecvNote] = React.useState("");
  const [selectedArId, setSelectedArId] = React.useState<string | null>(null);

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
      await qc.invalidateQueries({ queryKey: ["cash-sessions-closed"] });
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
      await qc.invalidateQueries({ queryKey: ["cash-sessions-closed"] });
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

  const arListQ = useQuery({
    queryKey: ["accounts-receivable", { arQ }],
    queryFn: () => fetchAR({ q: arQ.trim() || undefined, status: "PENDING" }),
    enabled: recvOpen,
  });
  const ars = arListQ.data?.ars ?? [];

  const recvMut = useMutation({
    mutationFn: () => receiveAR({ accountsReceivableId: String(selectedArId), note: recvNote.trim() || undefined }),
    onSuccess: async () => {
      toast.success("Recebimento registrado (IN).");
      setRecvOpen(false);
      setSelectedArId(null);
      setRecvNote("");
      setArQ("");
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
      await qc.invalidateQueries({ queryKey: ["cash-transactions"] });
      await qc.invalidateQueries({ queryKey: ["accounts-receivable"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao receber"),
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
            {t.reference && String(t.reference).startsWith("AR:") ? (
              <Link
                href={`/financeiro/recebimentos?q=${encodeURIComponent(String(t.reference).slice(3))}`}
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
        title="Abrir / Fechar Caixa"
        subtitle="Aqui você abre o caixa no início do dia e fecha no fim. Os recebimentos feitos no PDV ou em Recebimentos entram automaticamente na sessão aberta."
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
              onClick={() => {
                if (!cashSession) return toast.error("Abra o caixa antes de receber pagamentos.");
                setRecvOpen(true);
              }}
            >
              Receber
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
            emptyHint={
              txQ.isLoading
                ? "Buscando dados…"
                : "Use \"Receber\" para registrar pagamentos (IN) a partir de AR, ou \"Saída manual\" para despesas (OUT)."
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Histórico de sessões fechadas</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setClosedSessionsOpen((v) => !v)}>
            {closedSessionsOpen ? "Ocultar" : "Ver sessões fechadas"}
          </Button>
        </CardHeader>
        {closedSessionsOpen && (
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Ao fechar o caixa, o saldo de abertura, totais de entradas/saídas e saldo informado no fechamento ficam salvos aqui.
            </p>
            {closedSessionsQ.isLoading && <p className="text-sm">Carregando...</p>}
            {!closedSessionsQ.isLoading && closedSessions.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma sessão fechada ainda.</p>
            )}
            {!closedSessionsQ.isLoading && closedSessions.length > 0 && (
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2">Abertura</th>
                      <th className="text-left p-2">Fechamento</th>
                      <th className="text-left p-2">Operador</th>
                      <th className="text-right p-2">Saldo abertura</th>
                      <th className="text-right p-2">Saldo fechamento</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedSessions.map((s: any) => (
                      <tr key={s.id} className="border-t">
                        <td className="p-2 tabular-nums">{new Date(s.openedAt).toLocaleString("pt-BR")}</td>
                        <td className="p-2 tabular-nums">{s.closedAt ? new Date(s.closedAt).toLocaleString("pt-BR") : "—"}</td>
                        <td className="p-2">{s.userName}</td>
                        <td className="p-2 text-right tabular-nums">R$ {Number(s.openingBalance ?? 0).toFixed(2)}</td>
                        <td className="p-2 text-right tabular-nums">R$ {Number(s.closingBalance ?? 0).toFixed(2)}</td>
                        <td className="p-2">
                          <Button variant="ghost" size="sm" onClick={() => setDetailSessionId(s.id)}>Ver detalhes</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        )}
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

      <Dialog open={recvOpen} onOpenChange={setRecvOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receber pagamento</DialogTitle>
            <DialogDescription>
              Selecione um título (AR) pendente e confirme para registrar uma entrada (IN) no caixa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={arQ}
                onChange={(e) => setArQ(e.target.value)}
                placeholder="Buscar por cliente, id do AR ou id do pedido..."
              />
              <Input
                value={recvNote}
                onChange={(e) => setRecvNote(e.target.value)}
                placeholder="Observação (opcional)"
              />
            </div>

            <div className="max-h-[360px] overflow-auto rounded-md border">
              {arListQ.isLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
              ) : ars.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Nenhum AR pendente encontrado.</div>
              ) : (
                <div className="divide-y">
                  {ars.map((ar: any) => {
                    const client = ar?.order?.client?.name ?? "Cliente";
                    const amount = Number(ar.amount ?? 0).toFixed(2);
                    const isSel = selectedArId === ar.id;
                    return (
                      <button
                        key={ar.id}
                        type="button"
                        className={`w-full p-3 text-left hover:bg-accent ${isSel ? "bg-primary/10" : ""}`}
                        onClick={() => setSelectedArId(ar.id)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">{client}</div>
                          <div className="tabular-nums">R$ {amount}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          AR: <span className="font-mono">{ar.id}</span>
                          {ar.orderId ? <> · Pedido: <span className="font-mono">{ar.orderId}</span></> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRecvOpen(false)}>Cancelar</Button>
            <Button onClick={() => recvMut.mutate()} disabled={!selectedArId || recvMut.isPending}>
              {recvMut.isPending ? "Recebendo..." : "Confirmar recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailSessionId} onOpenChange={(open) => !open && setDetailSessionId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhe da sessão fechada</DialogTitle>
            <DialogDescription>
              Resumo e transações desta sessão de caixa.
            </DialogDescription>
          </DialogHeader>
          {sessionDetailQ.isLoading && <p className="text-sm">Carregando...</p>}
          {sessionDetail && !sessionDetailQ.isLoading && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><b>Abertura:</b> {new Date(sessionDetail.session.openedAt).toLocaleString("pt-BR")}</div>
                <div><b>Fechamento:</b> {sessionDetail.session.closedAt ? new Date(sessionDetail.session.closedAt).toLocaleString("pt-BR") : "—"}</div>
                <div><b>Operador:</b> {sessionDetail.session.userName}</div>
                <div><b>Saldo abertura:</b> R$ {Number(sessionDetail.session.openingBalance ?? 0).toFixed(2)}</div>
                <div><b>Total entradas (IN):</b> R$ {Number(sessionDetail.session.sumIn ?? 0).toFixed(2)}</div>
                <div><b>Total saídas (OUT):</b> R$ {Number(sessionDetail.session.sumOut ?? 0).toFixed(2)}</div>
                <div><b>Saldo esperado:</b> R$ {Number(sessionDetail.session.expectedBalance ?? 0).toFixed(2)}</div>
                <div><b>Saldo informado no fechamento:</b> R$ {Number(sessionDetail.session.closingBalance ?? 0).toFixed(2)}</div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Transações</h4>
                <div className="rounded-md border max-h-[280px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2">Data</th>
                        <th className="text-left p-2">Tipo</th>
                        <th className="text-right p-2">Valor</th>
                        <th className="text-left p-2">Descrição / Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(sessionDetail.transactions ?? []).map((t: any) => (
                        <tr key={t.id} className="border-t">
                          <td className="p-2 tabular-nums">{new Date(t.createdAt).toLocaleString("pt-BR")}</td>
                          <td className="p-2">{t.type}</td>
                          <td className="p-2 text-right tabular-nums">R$ {Number(t.amount ?? 0).toFixed(2)}</td>
                          <td className="p-2">{t.description ?? t.reference ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
