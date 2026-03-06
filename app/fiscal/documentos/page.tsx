"use client";

import * as React from "react";
import Link from "next/link";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FileDown, CheckCircle2, XCircle, ExternalLink, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

async function fetchInvoicesPage(params: {
  docType?: string;
  status?: string;
  take?: number;
  cursor?: string | null;
}) {
  const sp = new URLSearchParams();
  if (params.docType && params.docType !== "ALL") sp.set("docType", params.docType);
  if (params.status && params.status !== "ALL") sp.set("status", params.status);
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

export default function FiscalDocumentosPage() {
  const qc = useQueryClient();

  const [docType, setDocType] = React.useState<"ALL" | string>("ALL");
  const [status, setStatus] = React.useState<"ALL" | string>("ALL");
  const [monthFrom, setMonthFrom] = React.useState(() => monthRange().from);
  const [monthTo, setMonthTo] = React.useState(() => monthRange().to);

  const queryKey = React.useMemo(() => ["fiscal-invoices", { docType, status }], [docType, status]);

  const invoicesQ = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchInvoicesPage({
        docType,
        status,
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

  const markSentMut = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => postMarkSent(id, note),
    onSuccess: async () => {
      toast.success("Marcado como enviado ao contador.");
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
      await qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao marcar como enviado"),
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
        <div className="flex items-center gap-2">
          <span className="text-sm">{r.status}</span>
        </div>
      ),
    },
    {
      key: "orderId",
      header: "Pedido",
      cell: (r) => (
        <div className="min-w-[280px]">
          <div className="font-medium">{r.orderId ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {r.number ? `Nº: ${r.number} ` : null}
            {r.serie != null ? `· Série: ${r.serie} ` : null}
            {r.key ? `· Chave: ${r.key}` : null}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "Ações",
      headerClassName: "w-[300px]",
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={`/fiscal/documentos/${r.id}`}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir
            </Link>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => download(`/api/fiscal/invoices/${r.id}/preview`)}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Prévia PDF
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const sp = new URLSearchParams();
              sp.set("from", monthFrom);
              sp.set("to", monthTo);
              if (docType && docType !== "ALL") sp.set("docType", docType);
              if (status && status !== "ALL") sp.set("status", status);
              download(`/api/fiscal/invoices/export?${sp.toString()}`);
            }}
            title="Exportar CSV usando os filtros e o período selecionado"
          >
            <FileDown className="mr-2 h-4 w-4" />
            CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => markSentMut.mutate({ id: r.id, note: "Enviado ao contador" })}
            disabled={markSentMut.isPending}
            title="Marcar como enviado ao contador (ADMIN)"
          >
            {markSentMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Enviado
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentos Fiscais"
        subtitle="NFC-e, NF-e, CT-e, MDF-e (prévia) — prontos para plugar emissor depois."
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

      <FiltersShell
        search=""
        onSearchChange={() => {}}
        leftSlot={
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <Label>Tipo</Label>
                <Input
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  placeholder='ALL ou "NFE" / "NFCE" / "CTE" / "MDFE"'
                />
              </div>
              <div>
                <Label>Status</Label>
                <Input
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder='ALL ou "DRAFT" / "PENDING" / "CANCELLED"...'
                />
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
    </div>
  );
}
