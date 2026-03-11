"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FileDown, Ban, Copy, Download } from "lucide-react";

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

function badgeTone(kind: "ok" | "warn" | "muted" | "info") {
  if (kind === "ok") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (kind === "warn") return "border-amber-200 bg-amber-50 text-amber-700";
  if (kind === "info") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-border bg-muted text-muted-foreground";
}

function statusTone(status: string) {
  const s = String(status ?? "").toUpperCase();
  if (["AUTHORIZED", "EMITTED", "APPROVED"].includes(s)) return badgeTone("ok");
  if (["DRAFT", "PENDING", "RECEIVED"].includes(s)) return badgeTone("info");
  if (["REJECTED", "DENIED", "CANCELLED"].includes(s)) return badgeTone("warn");
  return badgeTone("muted");
}

function docTypeLabel(v: string) {
  const x = String(v ?? "").toUpperCase();
  if (x === "NFCE") return "NFC-e";
  if (x === "NFE") return "NF-e";
  return x || "—";
}

function prettyDate(v?: string | null) {
  return v ? new Date(v).toLocaleString("pt-BR") : "—";
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function extractArtifacts(payload: any) {
  const artifacts = payload?.artifacts ?? null;
  return {
    provider: artifacts?.provider ?? null,
    externalId: artifacts?.externalId ?? null,
    downloadedAt: artifacts?.downloadedAt ?? null,
    xmlProc: artifacts?.xmlProc ?? null,
    pdf: artifacts?.pdf ?? null,
  };
}

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

async function postEmit(id: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/emit`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao emitir documento");
  return data;
}

async function postConsultProvider(id: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/consult`, {
    method: "POST",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao consultar provider");
  return data;
}

export default function FiscalDocumentoDetalhePage() {
  const params = useParams();
  const sp = useSearchParams();
  const id = String(params?.id ?? "");

  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("Cancelado por solicitação do cliente");

  const invQ = useQuery({
    queryKey: ["fiscal-invoice", id],
    queryFn: () => fetchInvoice(id),
    enabled: Boolean(id),
  });

  React.useEffect(() => {
    if (invQ.isError) toast.error((invQ.error as Error)?.message ?? "Erro ao carregar");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invQ.isError]);

  const consultMut = useMutation({
    mutationFn: () => postConsultProvider(id),
    onSuccess: async () => {
      toast.success("Consulta ao provider executada.");
      await qc.invalidateQueries({ queryKey: ["fiscal-invoice", id] });
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao consultar provider"),
  });

  const emitMut = useMutation({
    mutationFn: () => postEmit(id),
    onSuccess: async () => {
      toast.success("Emissão iniciada.");
      await qc.invalidateQueries({ queryKey: ["fiscal-invoice", id] });
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao emitir"),
  });

  const cancelMut = useMutation({
    mutationFn: () => postCancel(id, cancelReason),
    onSuccess: async () => {
      toast.success("Cancelamento solicitado.");
      setCancelOpen(false);
      await qc.invalidateQueries({ queryKey: ["fiscal-invoice", id] });
      await qc.invalidateQueries({ queryKey: ["fiscal-invoices"] });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao cancelar"),
  });

  const inv = invQ.data?.invoice ?? null;
  const payload = inv?.payload ?? null;

  const payloadRef = React.useRef<HTMLDivElement | null>(null);
  const [payloadGlow, setPayloadGlow] = React.useState(false);

  const focusPayload = React.useCallback(() => {
    const el = payloadRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setPayloadGlow(true);
    window.setTimeout(() => setPayloadGlow(false), 1600);
  }, []);

  React.useEffect(() => {
    // suporta:
    // - /fiscal/documentos/:id?focus=payload
    // - /fiscal/documentos/:id#payload
    const focus = String(sp?.get("focus") ?? "").toLowerCase();
    const hash = typeof window !== "undefined" ? String(window.location.hash ?? "") : "";
    if (focus === "payload" || hash === "#payload") {
      // dá tempo pro layout renderizar
      window.setTimeout(() => focusPayload(), 120);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const payloadText = React.useMemo(() => safeJsonStringify(payload), [payload]);
  const artifacts = React.useMemo(() => extractArtifacts(payload), [payload]);

  const copyPayload = async () => {
    try {
      await navigator.clipboard.writeText(payloadText);
      toast.success("Payload copiado.");
    } catch {
      // fallback (alguns browsers bloqueiam clipboard em certos contextos)
      try {
        const ta = document.createElement("textarea");
        ta.value = payloadText;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast.success("Payload copiado.");
      } catch {
        toast.error("Não foi possível copiar o payload.");
      }
    }
  };

  const downloadPayload = () => {
    const filename = `payload_${id}.json`;
    const blob = new Blob([payloadText], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Download do payload iniciado.");
  };

  const downloadPreview = () => window.open(`/api/fiscal/invoices/${id}/preview`, "_blank", "noopener,noreferrer");

  const downloadXmlFromPayload = () => {
    const xml = String((payload as any)?.artifacts?.xmlProc?.content ?? "");
    if (!xml) {
      toast.error("XML ainda não foi baixado para este documento.");
      return;
    }
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xml_proc_${id}.xml`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Download do XML iniciado.");
  };

  const downloadPdfFromPayload = () => {
    const base64 = String((payload as any)?.artifacts?.pdf?.contentBase64 ?? "");
    const mimeType = String((payload as any)?.artifacts?.pdf?.mimeType ?? "application/pdf");
    if (!base64) {
      toast.error("PDF ainda não foi baixado para este documento.");
      return;
    }
    const link = document.createElement("a");
    link.href = `data:${mimeType};base64,${base64}`;
    link.download = `danfe_${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("Download do PDF iniciado.");
  };

  if (invQ.isLoading) return <div className="p-6">Carregando...</div>;
  if (!inv) return <div className="p-6 text-red-600">Documento não encontrado.</div>;

  const additionalInfo = ((payload as any)?.additionalInfo ?? null) as
    | {
        fiscalNote?: string | null;
        paymentNote?: string | null;
        combined?: string | null;
      }
    | null;

  const payloadAny = (payload ?? {}) as any;
  const payloadClient = payloadAny?.client ?? null;
  const payloadOrder = payloadAny?.order ?? null;
  const payloadItems = Array.isArray(payloadAny?.items) ? payloadAny.items : [];
  const payloadPayment = payloadAny?.payment ?? null;
  const paymentLabel = String(payloadPayment?.method ?? "").toUpperCase() || "—";
  const totalLabel = payloadOrder?.total != null ? String(payloadOrder.total) : "—";

  const currentStatus = String(inv?.status ?? "");
  const isDraft = currentStatus.toUpperCase() === "DRAFT";
  const isAuthorized = currentStatus.toUpperCase() === "AUTHORIZED" || currentStatus.toUpperCase() === "EMITTED";
  const isCancelled = currentStatus.toUpperCase() === "CANCELLED";

  const emissionHint = isCancelled
    ? "Documento cancelado."
    : isAuthorized
      ? "Documento autorizado. Consulte provider, baixe XML/PDF ou siga com rotinas fiscais."
      : isDraft
        ? "Revise payload, dados adicionais e provider antes de emitir."
        : "Acompanhe o status fiscal e consulte o provider quando necessário.";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documento Fiscal"
        subtitle={inv ? `Tipo: ${inv.docType} · Status: ${inv.status}` : "Carregando..."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {inv?.orderId && (
              <Button asChild variant="outline">
                <Link href={`/financeiro/pdv?open=${encodeURIComponent(String(inv.orderId))}`}>
                  Ir para o PDV
                </Link>
              </Button>
            )}

            <Button variant="outline" onClick={focusPayload} disabled={!inv || invQ.isLoading}>
              Ir para Payload
            </Button>

            <Button variant="outline" onClick={downloadPreview} disabled={!inv || invQ.isLoading}>
              <FileDown className="mr-2 h-4 w-4" />
              Prévia PDF
            </Button>

            {String(inv?.status ?? "").toUpperCase() === "DRAFT" ? (
              <Button
                variant="default"
                onClick={() => emitMut.mutate()}
                disabled={!inv || emitMut.isPending}
                title={String(inv?.docType ?? "").toUpperCase() === "NFE" ? "Emitir NF-e" : "Emitir NFC-e"}
              >
                {emitMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {String(inv?.docType ?? "").toUpperCase() === "NFE" ? "Emitir NF-e" : "Emitir NFC-e"}
              </Button>
            ) : null}

            <Button
              variant="outline"
              onClick={() => consultMut.mutate()}
              disabled={!inv || consultMut.isPending}
              title="Consulta status diretamente no provider configurado"
            >
              {consultMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Consultar provider
            </Button>

            {String(inv?.status ?? "").toUpperCase() === "AUTHORIZED" ? (
              <Button
                variant="destructive"
                onClick={() => setCancelOpen(true)}
                disabled={!inv || inv?.status === "CANCELLED"}
                title="Solicita cancelamento no provider fiscal"
              >
                <Ban className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">ID:</span> {inv?.id ?? "—"}</div>
          <div><span className="text-muted-foreground">Pedido:</span> {inv?.orderId ?? "—"}</div>
          <div><span className="text-muted-foreground">Tipo:</span> {docTypeLabel(inv?.docType ?? "")} {inv?.model ? `(modelo ${inv.model})` : ""}</div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Status:</span>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(currentStatus)}`}>
              {currentStatus || "—"}
            </span>
          </div>
          <div><span className="text-muted-foreground">Criado em:</span> {prettyDate(inv?.createdAt as string)}</div>
          <div><span className="text-muted-foreground">Emitido em:</span> {prettyDate(inv?.issuedAt as string | null)}</div>
          <div><span className="text-muted-foreground">Chave:</span> {inv?.key ?? "—"}</div>
          <div><span className="text-muted-foreground">Série/Número:</span> {inv?.serie ?? "—"} / {inv?.number ?? "—"}</div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            {emissionHint}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Artefatos fiscais</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={downloadXmlFromPayload}
                disabled={!artifacts?.xmlProc}
                title="Baixar XML processado do payload"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar XML
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadPdfFromPayload}
                disabled={!artifacts?.pdf}
                title="Baixar PDF/DANFE do payload"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Provider:</span> {artifacts?.provider ?? "—"}</div>
          <div><span className="text-muted-foreground">External ID:</span> {artifacts?.externalId ?? (inv as any)?.externalId ?? "—"}</div>
          <div><span className="text-muted-foreground">Baixado em:</span> {prettyDate(artifacts?.downloadedAt)}</div>
          <div><span className="text-muted-foreground">XML processado:</span> {artifacts?.xmlProc ? `${artifacts.xmlProc.sizeBytes} bytes` : "Não disponível"}</div>
          <div><span className="text-muted-foreground">PDF/DANFE:</span> {artifacts?.pdf ? `${artifacts.pdf.sizeBytes} bytes` : "Não disponível"}</div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Quando autorizados e baixados, os artefatos ficam persistidos no payload do documento para consulta e download rápido.
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Visão fiscal da emissão</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Destinatário</div>
            <div className="space-y-1 text-sm">
              <div><span className="text-muted-foreground">Nome:</span> {payloadClient?.name ?? "—"}</div>
              <div><span className="text-muted-foreground">Documento:</span> {payloadClient?.document ?? "—"}</div>
              <div><span className="text-muted-foreground">IE:</span> {payloadClient?.ie ?? "—"}</div>
              <div><span className="text-muted-foreground">Telefone:</span> {payloadClient?.phone ?? "—"}</div>
              <div><span className="text-muted-foreground">Email:</span> {payloadClient?.email ?? "—"}</div>
              <div><span className="text-muted-foreground">Endereço:</span> {[payloadClient?.address?.street, payloadClient?.address?.number, payloadClient?.address?.district].filter(Boolean).join(", ") || "—"}</div>
              <div><span className="text-muted-foreground">Cidade/UF:</span> {[payloadClient?.address?.city, payloadClient?.address?.state].filter(Boolean).join(" / ") || "—"}</div>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pedido / pagamento</div>
            <div className="space-y-1 text-sm">
              <div><span className="text-muted-foreground">Pedido:</span> {payloadOrder?.number ?? payloadOrder?.id ?? inv?.orderId ?? "—"}</div>
              <div><span className="text-muted-foreground">Total:</span> {totalLabel}</div>
              <div><span className="text-muted-foreground">Pagamento:</span> {paymentLabel}</div>
              <div><span className="text-muted-foreground">Parcelas:</span> {payloadPayment?.installments ?? "—"}</div>
              <div><span className="text-muted-foreground">Bandeira:</span> {payloadPayment?.cardBrand ?? "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Itens fiscais da emissão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!payloadItems.length ? (
            <div className="text-sm text-muted-foreground">Sem itens no payload.</div>
          ) : (
            payloadItems.map((it: any, idx: number) => (
              <div key={`${it?.productId ?? "item"}-${idx}`} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium">{it?.name ?? `Item ${idx + 1}`}</div>
                  <div className="text-sm text-muted-foreground">
                    {it?.qty ?? "—"} x {it?.unitPrice ?? "—"}
                  </div>
                </div>
                <div className="grid gap-2 md:grid-cols-3 text-sm">
                  <div><span className="text-muted-foreground">NCM:</span> {it?.fiscal?.ncm ?? "—"}</div>
                  <div><span className="text-muted-foreground">CFOP:</span> {it?.fiscal?.cfop ?? "—"}</div>
                  <div><span className="text-muted-foreground">CST/CSOSN:</span> {it?.fiscal?.cst ?? it?.fiscal?.csosn ?? "—"}</div>
                  <div><span className="text-muted-foreground">Origem:</span> {it?.fiscal?.origin ?? "—"}</div>
                  <div><span className="text-muted-foreground">CEST:</span> {it?.fiscal?.cest ?? "—"}</div>
                  <div><span className="text-muted-foreground">Perfil:</span> {it?.fiscal?.taxProfile ?? "—"}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Dados adicionais da nota</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Observação do pedido:</span> {additionalInfo?.fiscalNote ?? "—"}</div>
          <div><span className="text-muted-foreground">Observação do pagamento:</span> {additionalInfo?.paymentNote ?? "—"}</div>
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Texto consolidado para a nota</div>
            <div>{additionalInfo?.combined ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      <Card
        id="payload"
        ref={(node: any) => {
          payloadRef.current = node as HTMLDivElement | null;
        }}
        className={`shadow-sm ${payloadGlow ? "ring-2 ring-primary" : ""}`}
      >
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Payload (debug / pronto para emissor)</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={copyPayload}
                disabled={!inv || invQ.isLoading}
                title="Copia o JSON do payload para a área de transferência"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar payload
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={downloadPayload}
                disabled={!inv || invQ.isLoading}
                title="Baixa o payload como arquivo .json"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar payload.json
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[520px] overflow-auto rounded-md bg-muted p-3 text-xs">
            {payloadText}
          </pre>
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar documento</DialogTitle>
            <DialogDescription>
              O cancelamento é enviado ao provider fiscal com a justificativa informada. Use somente quando o documento autorizado realmente precisar ser cancelado.
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
              disabled={cancelMut.isPending}
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


