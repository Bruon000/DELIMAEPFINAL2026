"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FileDown, XCircle, ExternalLink, RefreshCw, Ban, Search, AlertTriangle, FilePlus2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";

type InvoiceRow = {
  id: string;
  docType: string;
  model: number | null;
  status: string;
  orderId: string | null;
  number: string | null;
  serie: number | null;
  key: string | null;
  issuedAt: string | null;
  createdAt: string;
  externalId: string | null;
};

function dt(v: unknown) {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v ?? "");
  return d.toLocaleString("pt-BR");
}

function docLabel(docType: string, model: number | null) {
  const t = String(docType ?? "").toUpperCase();
  if (t === "NFE") return "NF-e (55)";
  if (t === "NFCE") return "NFC-e (65)";
  if (t === "CTE") return "CT-e";
  if (t === "MDFE") return "MDF-e";
  if (t === "NFSE") return "NFS-e";
  return model ? `${t} (${model})` : t;
}

function badgeTone(kind: "ok" | "warn" | "muted" | "info") {
  if (kind === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (kind === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  if (kind === "info") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-border bg-muted text-muted-foreground";
}

function statusTone(status: string) {
  const s = String(status ?? "").toUpperCase();
  if (["AUTHORIZED", "EMITTED", "APPROVED"].includes(s)) return badgeTone("ok");
  if (s === "DRAFT") return badgeTone("muted");
  if (["PENDING", "RECEIVED"].includes(s)) return badgeTone("info");
  if (["REJECTED", "DENIED", "CANCELLED"].includes(s)) return badgeTone("warn");
  return badgeTone("muted");
}

async function fetchInvoicesPage(params: {
  docType?: string;
  status?: string;
  from?: string;
  to?: string;
  take?: number;
  cursor?: string | null;
}) {
  const sp = new URLSearchParams();
  if (params.docType && params.docType !== "ALL") sp.set("docType", params.docType);
  if (params.status && params.status !== "ALL") sp.set("status", params.status);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  sp.set("take", String(params.take ?? 30));
  if (params.cursor) sp.set("cursor", params.cursor);

  const res = await fetch(`/api/fiscal/invoices?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar documentos fiscais");
  return data as { rows: InvoiceRow[]; nextCursor: string | null };
}

async function postMarkSent(id: string, note?: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/sent-to-accountant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: note ?? "" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao marcar como enviado");
  return data;
}

async function postConsult(id: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/consult`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao consultar documento");
  return data;
}

async function postEmit(id: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/emit`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao emitir documento");
  return data;
}

async function postDownload(id: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/download`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao baixar XML/PDF");
  return data;
}

async function postCancel(id: string, reason: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao cancelar documento");
  return data;
}

function download(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function ymd(d: Date) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function monthRange(now = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: ymd(from), to: ymd(to) };
}

async function fetchPendingInutilizations() {
  const res = await fetch("/api/fiscal/inutilize");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { pending: [] };
  return data as { pending: any[] };
}

async function postInutilize(invoiceId: string, reason: string) {
  const res = await fetch("/api/fiscal/inutilize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId, reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao inutilizar");
  return data;
}

export default function FiscalDocumentosPage() {
  const qc = useQueryClient();

  const [docType, setDocType] = React.useState<"ALL" | string>("ALL");
  const [status, setStatus] = React.useState<"ALL" | string>("ALL");
  const [monthFrom, setMonthFrom] = React.useState(() => monthRange().from);
  const [monthTo, setMonthTo] = React.useState(() => monthRange().to);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelId, setCancelId] = React.useState("");
  const [cancelReason, setCancelReason] = React.useState("Cancelado por solicitação do cliente");

  const inutQ = useQuery({ queryKey: ["pending-inutilizations"], queryFn: fetchPendingInutilizations, refetchInterval: 60_000 });
  const pendingInut = inutQ.data?.pending ?? [];
  const inutMut = useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) => postInutilize(invoiceId, reason),
    onSuccess: async () => {
      toast.success("Numeração inutilizada com sucesso.");
      await qc.invalidateQueries({ queryKey: ["pending-inutilizations"] });
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao inutilizar"),
  });

  const queryKey = React.useMemo(() => ["fiscal-invoices", { docType, status, monthFrom, monthTo }], [docType, status, monthFrom, monthTo]);

  const invoicesQ = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchInvoicesPage({
        docType,
        status,
        from: monthFrom,
        to: monthTo,
        take: 30,
        cursor: pageParam ?? null,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last?.nextCursor ?? null,
  });

  React.useEffect(() => {
    if (invoicesQ.isError) {
      toast.error((invoicesQ.error as Error)?.message ?? "Erro ao carregar documentos fiscais");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoicesQ.isError]);

  const rows = React.useMemo(() => {
    const pages = invoicesQ.data?.pages ?? [];
    return pages.flatMap((p) => p?.rows ?? []);
  }, [invoicesQ.data]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reservado para uso futuro
  const markSentMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => postMarkSent(id, note),
    onSuccess: async () => {
      toast.success("Marcado como enviado ao contador.");
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
      await qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao marcar como enviado"),
  });

  const consultMut = useMutation({
    mutationFn: (id: string) => postConsult(id),
    onSuccess: async () => {
      toast.success("Status consultado com sucesso.");
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
      await qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao consultar documento"),
  });

  const emitMut = useMutation({
    mutationFn: (id: string) => postEmit(id),
    onSuccess: async () => {
      toast.success("Emissão iniciada.");
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
      await qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao emitir documento"),
  });

  const downloadMut = useMutation({
    mutationFn: (id: string) => postDownload(id),
    onSuccess: async () => {
      toast.success("XML/PDF baixados e persistidos.");
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
      await qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao baixar XML/PDF"),
  });

  const cancelMut = useMutation({
    mutationFn: () => postCancel(cancelId, cancelReason),
    onSuccess: async () => {
      toast.success("Cancelamento solicitado.");
      setCancelOpen(false);
      setCancelId("");
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
      await qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao cancelar documento"),
  });

  const columns: Column<InvoiceRow>[] = [
    {
      key: "createdAt",
      header: "Criado em",
      headerClassName: "w-[190px]",
      cell: (r) => <div className="tabular-nums">{dt(r.createdAt)}</div>,
    },
    {
      key: "docType",
      header: "Tipo",
      headerClassName: "w-[140px]",
      cell: (r) => <div className="font-medium">{docLabel(r.docType, r.model)}</div>,
    },
    {
      key: "status",
      header: "Status",
      headerClassName: "w-[140px]",
      cell: (r) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(r.status)}`}>
          {String(r.status ?? "").toUpperCase() === "AUTHORIZED"
            ? "Autorizada"
            : String(r.status ?? "").toUpperCase() === "REJECTED"
              ? "Rejeitada"
              : String(r.status ?? "").toUpperCase() === "CANCELLED"
                ? "Cancelada"
                : String(r.status ?? "").toUpperCase() === "PENDING"
                  ? "Pendente"
                  : String(r.status ?? "").toUpperCase() === "DRAFT"
                    ? "Rascunho"
                    : r.status}
        </span>
      ),
    },
    {
      key: "orderId",
      header: "Pedido",
      cell: (r) => (
        <div className="min-w-[160px] max-w-[220px]">
          <div className="font-medium truncate" title={r.orderId ?? undefined}>{r.orderId ?? "—"}</div>
          <div className="text-xs text-muted-foreground truncate" title={r.key ?? undefined}>
            {r.number != null ? `Nº ${r.number}` : null}
            {r.serie != null ? ` · Série ${r.serie}` : null}
            {r.key ? ` · ${r.key.length > 20 ? `${r.key.slice(0, 10)}…${r.key.slice(-8)}` : r.key}` : null}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      headerClassName: "w-[280px]",
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/fiscal/documentos/${r.id}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir
            </Link>
          </Button>

          {String(r.status).toUpperCase() === "DRAFT" ? (
            <Button
              size="sm"
              variant="default"
              onClick={() => emitMut.mutate(r.id)}
              disabled={emitMut.isPending}
              title={String(r.docType).toUpperCase() === "NFE" ? "Emitir NF-e" : "Emitir NFC-e"}
            >
              {emitMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FilePlus2 className="mr-2 h-4 w-4" />}
              {String(r.docType).toUpperCase() === "NFE" ? "Emitir NF-e" : "Emitir NFC-e"}
            </Button>
          ) : null}

          {String(r.status).toUpperCase() === "PENDING" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => consultMut.mutate(r.id)}
              disabled={consultMut.isPending}
              title="Atualizar status no provider"
            >
              {consultMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Atualizar status
            </Button>
          ) : null}

          {String(r.status).toUpperCase() === "AUTHORIZED" ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => downloadMut.mutate(r.id)}
                disabled={downloadMut.isPending}
                title="Baixar XML/PDF"
              >
                {downloadMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                XML/PDF
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setCancelId(r.id);
                  setCancelOpen(true);
                }}
                title="Cancelar documento autorizado"
              >
                <Ban className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            </>
          ) : null}

          {String(r.status).toUpperCase() === "REJECTED" ? (
            <Button size="sm" variant="outline" asChild title="Abrir para inutilização">
              <Link href={`/fiscal/documentos/${r.id}`}>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Inutilizar
              </Link>
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentos Fiscais"
        subtitle="Lista de NF-e e NFC-e. Use Abrir para ver detalhes, consultar, baixar XML/PDF, cancelar ou marcar enviado ao contador."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => invoicesQ.refetch()}
              disabled={invoicesQ.isFetching}
            >
              {invoicesQ.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Atualizar
            </Button>
          </div>
        }
      />

      {/* Inutilization alert */}
      {pendingInut.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-800">
                {pendingInut.length} nota(s) rejeitada(s) pendente(s) de inutilização
              </div>
              <div className="text-xs text-amber-700">
                Numerações rejeitadas pela SEFAZ devem ser inutilizadas para evitar problemas fiscais.
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {pendingInut.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2">
                <div className="text-xs">
                  <span className="font-medium">{inv.docType === "NFE" ? "NF-e" : "NFC-e"}</span>
                  {" "}nº {inv.number ?? "?"} · série {inv.serie ?? 1}
                  <span className="ml-2 text-muted-foreground">({String(inv.status).toUpperCase()})</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs shrink-0"
                  disabled={inutMut.isPending}
                  onClick={() => inutMut.mutate({
                    invoiceId: inv.id,
                    reason: `Inutilização de ${inv.docType === "NFE" ? "NF-e" : "NFC-e"} nº ${inv.number} rejeitada pela SEFAZ`,
                  })}
                >
                  {inutMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                  Inutilizar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <FiltersShell
        search=""
        onSearchChange={() => {}}
        leftSlot={
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label>Tipo</Label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                >
                  <option value="ALL">Todos</option>
                  <option value="NFE">NF-e</option>
                  <option value="NFCE">NFC-e</option>
                  <option value="CTE">CT-e</option>
                  <option value="MDFE">MDF-e</option>
                  <option value="NFSE">NFS-e</option>
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ALL">Todos</option>
                  <option value="DRAFT">Rascunho</option>
                  <option value="PENDING">Pendente</option>
                  <option value="AUTHORIZED">Autorizada</option>
                  <option value="REJECTED">Rejeitada</option>
                  <option value="CANCELLED">Cancelada</option>
                  <option value="VOIDED">Inutilizada</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDocType("ALL");
                    setStatus("ALL");
                    const mr = monthRange();
                    setMonthFrom(mr.from);
                    setMonthTo(mr.to);
                    toast.info("Filtros limpos.");
                  }}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Limpar
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label>De (YYYY-MM-DD)</Label>
                <Input value={monthFrom} onChange={(e) => setMonthFrom(e.target.value)} placeholder="2026-03-01" />
              </div>
              <div>
                <Label>Até (YYYY-MM-DD)</Label>
                <Input value={monthTo} onChange={(e) => setMonthTo(e.target.value)} placeholder="2026-03-31" />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const sp = new URLSearchParams();
                    sp.set("from", monthFrom);
                    sp.set("to", monthTo);
                    if (docType && docType !== "ALL") sp.set("docType", docType);
                    if (status && status !== "ALL") sp.set("status", status);
                    download(`/api/fiscal/invoices/export?${sp.toString()}`);
                  }}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </div>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            emptyTitle="Nenhum documento fiscal"
            emptyHint="Crie uma invoice a partir de um pedido confirmado."
          />
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {rows.length} registro(s)
            </div>
            <Button
              variant="outline"
              onClick={() => invoicesQ.fetchNextPage()}
              disabled={!invoicesQ.hasNextPage || invoicesQ.isFetchingNextPage}
            >
              {invoicesQ.isFetchingNextPage ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Carregar mais
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar documento fiscal</DialogTitle>
            <DialogDescription>
              Informe a justificativa do cancelamento. Use somente para documento autorizado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="cancelReason">Justificativa</Label>
            <Input
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Motivo do cancelamento"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMut.mutate()}
              disabled={cancelMut.isPending || !cancelId}
            >
              {cancelMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
