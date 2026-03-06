"use client";

import * as React from "react";
import { toast } from "sonner";
import { FileDown, CheckCircle2, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ymd(d: Date) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function rangeFromYm(ym: string) {
  const [y, m] = ym.split("-").map((x) => Number(x));
  const from = new Date(y, (m ?? 1) - 1, 1);
  const to = new Date(y, (m ?? 1), 0);
  return { from: ymd(from), to: ymd(to) };
}

function dueDateSimples(ym: string) {
  const [y, m] = ym.split("-").map((x) => Number(x));
  const d = new Date(y, (m ?? 1), 20); // dia 20 do próximo mês
  return d.toLocaleDateString("pt-BR");
}

function download(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function postBulkMarkSent(params: { from: string; to: string; note: string }) {
  const sp = new URLSearchParams();
  sp.set("from", params.from);
  sp.set("to", params.to);

  const res = await fetch(`/api/fiscal/invoices/sent-to-accountant-bulk?${sp.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: params.note }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao marcar em lote");
  return data as { ok: boolean; updated: number };
}

export default function ContabilidadeExportarMesPage() {
  const now = new Date();
  const defaultYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [ym, setYm] = React.useState(defaultYm);
  const { from, to } = React.useMemo(() => rangeFromYm(ym), [ym]);
  const venc = React.useMemo(() => dueDateSimples(ym), [ym]);

  const [note, setNote] = React.useState("Enviado ao contador");

  const bulkMut = useMutation({
    mutationFn: () => postBulkMarkSent({ from, to, note }),
    onSuccess: (data) => toast.success(`OK! Marcadas ${data.updated} invoice(s) como enviadas.`),
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao marcar"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contabilidade"
        subtitle="Exportar mês para contador externo (CSV) e marcar como enviado."
      />

      <FiltersShell
        search=""
        onSearchChange={() => {}}
        leftSlot={
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label>Mês (YYYY-MM)</Label>
                <Input value={ym} onChange={(e) => setYm(e.target.value)} placeholder="2026-03" />
              </div>

              <div className="text-sm">
                <div className="mt-6 rounded-md border bg-card p-3">
                  <div><span className="text-muted-foreground">Período:</span> {from} a {to}</div>
                  <div className="mt-1"><span className="text-muted-foreground">Vencimento Simples:</span> {venc} (dia 20 do mês seguinte)</div>
                </div>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const sp = new URLSearchParams();
                    sp.set("from", from);
                    sp.set("to", to);
                    download(`/api/fiscal/invoices/export?${sp.toString()}`);
                  }}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Baixar CSV do mês
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label>Observação (opcional)</Label>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Enviado por e-mail / WhatsApp" />
              </div>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  onClick={() => bulkMut.mutate()}
                  disabled={bulkMut.isPending}
                  className="w-full"
                >
                  {bulkMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Marcar mês como enviado
                </Button>
              </div>
            </div>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Dica rápida</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Você exporta o CSV do mês (1º ao último dia) e envia ao contador. Depois marque como enviado para manter controle interno.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
