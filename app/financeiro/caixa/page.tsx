"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchSession() {
  const res = await fetch("/api/cash/session");
  if (!res.ok) throw new Error("Erro ao carregar sessão");
  return res.json();
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

export default function CaixaPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["cash-session"], queryFn: fetchSession });

  const cashSession = data?.cashSession;
  const txs = cashSession?.transactions ?? [];

  const [openingBalance, setOpeningBalance] = React.useState(0);
  const [closingBalance, setClosingBalance] = React.useState(0);
  const [msg, setMsg] = React.useState<string | null>(null);

  const openMut = useMutation({
    mutationFn: () => openCash(openingBalance),
    onSuccess: async () => {
      setMsg("Caixa aberto.");
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const closeMut = useMutation({
    mutationFn: () => closeCash(closingBalance),
    onSuccess: async () => {
      setMsg("Caixa fechado.");
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const sumIn = txs.filter((t: any) => t.type === "IN").reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);
  const sumOut = txs.filter((t: any) => t.type === "OUT").reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0);
  const movement = sumIn - sumOut;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Caixa</h1>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Sessão</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p>Carregando...</p>}

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
          {txs.length === 0 && <p className="text-muted-foreground">Sem transações ainda.</p>}
          {txs.map((t: any) => (
            <div key={t.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{t.type} · R$ {Number(t.amount ?? 0).toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">{t.description ?? "-"} {t.reference ? `· Ref: ${t.reference}` : ""}</div>
              </div>
              <div className="text-sm text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
