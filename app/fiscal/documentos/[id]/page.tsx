"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FileDown, Ban, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/page-header";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Invoice = {
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
  payload?: unknown;
  [key: string]: unknown;
};

async function fetchInvoice(id: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar documento fiscal");
  return data as { invoice: Invoice };
}

async function postCancel(id: string, reason: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao cancelar");
  return data;
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

export default function FiscalDocumentoDetalhePage() {
  const params = useParams();
  const id = String(params?.id ?? "");

  const qc = useQueryClient();

  const invQ = useQuery({
    queryKey: ["fiscal-invoice", id],
    queryFn: () => fetchInvoice(id),
    enabled: Boolean(id),
  });

  React.useEffect(() => {
    if (invQ.isError) toast.error((invQ.error as Error)?.message ?? "Erro ao carregar");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invQ.isError]);

  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("Cancelado por solicitação do cliente");

  const cancelMut = useMutation({
    mutationFn: () => postCancel(id, cancelReason),
    onSuccess: async () => {
      toast.success("Documento cancelado.");
      setCancelOpen(false);
      await qc.invalidateQueries({ queryKey: ["fiscal-invoice", id] });
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao cancelar"),
  });

  const markSentMut = useMutation({
    mutationFn: () => postMarkSent(id, "Enviado ao contador"),
    onSuccess: async () => {
      toast.success("Marcado como enviado ao contador.");
      await qc.invalidateQueries({ queryKey: ["fiscal-invoice", id] });
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao marcar enviado"),
  });

  const inv = invQ.data?.invoice ?? null;
  const payload = inv?.payload ?? null;

  const downloadPreview = () => window.open(`/api/fiscal/invoices/${id}/preview`, "_blank", "noopener,noreferrer");

  if (invQ.isLoading) return <div className="p-6">Carregando...</div>;
  if (!inv) return <div className="p-6 text-red-600">Documento não encontrado.</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documento Fiscal"
        subtitle={inv ? `Tipo: ${inv.docType} · Status: ${inv.status}` : "Carregando..."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={downloadPreview} disabled={!inv || invQ.isLoading}>
              <FileDown className="mr-2 h-4 w-4" />
              Prévia PDF
            </Button>

            <Button
              variant="outline"
              onClick={() => markSentMut.mutate()}
              disabled={!inv || markSentMut.isPending}
              title="ADMIN"
            >
              {markSentMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Enviado ao contador
            </Button>

            <Button variant="destructive" onClick={() => setCancelOpen(true)} disabled={!inv || inv?.status === "CANCELLED"}>
              <Ban className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">ID:</span> {inv?.id ?? "—"}</div>
          <div><span className="text-muted-foreground">Pedido:</span> {inv?.orderId ?? "—"}</div>
          <div><span className="text-muted-foreground">Tipo:</span> {inv?.docType ?? "—"} {inv?.model ? `(modelo ${inv.model})` : ""}</div>
          <div><span className="text-muted-foreground">Status:</span> {inv?.status ?? "—"}</div>
          <div><span className="text-muted-foreground">Criado em:</span> {inv?.createdAt ? new Date(inv.createdAt as string).toLocaleString("pt-BR") : "—"}</div>
          <div><span className="text-muted-foreground">Emitido em:</span> {inv?.issuedAt ? new Date(inv.issuedAt as string).toLocaleString("pt-BR") : "—"}</div>
          <div><span className="text-muted-foreground">Chave:</span> {inv?.key ?? "—"}</div>
          <div><span className="text-muted-foreground">Série/Número:</span> {inv?.serie ?? "—"} / {inv?.number ?? "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payload (debug / pronto para emissor)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[520px] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar documento</DialogTitle>
            <DialogDescription>
              Isso marca o documento como CANCELLED (mock). Quando plugar emissor, aqui chamará cancelamento oficial.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
              {cancelMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

