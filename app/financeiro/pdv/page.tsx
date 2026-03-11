"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, Ban, RefreshCcw, FileDown, ChevronDown, ChevronRight,
  CircleHelp, Check, CheckCircle, CreditCard, FileText, Receipt, BarChart3,
  DollarSign, Clock, AlertTriangle, ShoppingCart, Undo2, Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/erp/page-header";
import { DataTable, type Column } from "@/components/erp/data-table";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CANCEL_REASONS = [
  { key: "CLIENTE_DESISTIU", label: "Desistência do cliente", text: "Desistência do cliente após emissão da nota fiscal" },
  { key: "ERRO_DADOS", label: "Erro nos dados do documento", text: "Erro nos dados do documento fiscal (valores, produtos ou quantidades incorretos)" },
  { key: "ERRO_DESTINATARIO", label: "Dados incorretos do destinatário", text: "Dados incorretos do destinatário da nota fiscal" },
  { key: "DUPLICIDADE", label: "Documento emitido em duplicidade", text: "Documento fiscal emitido em duplicidade" },
  { key: "OUTRO", label: "Outro (digitar motivo)", text: "" },
] as const;

class ApiError extends Error {
  data: any;
  status: number;
  constructor(message: string, data?: any, status = 400) {
    super(message);
    this.name = "ApiError";
    this.data = data ?? null;
    this.status = status;
  }
}

function badgeTone(kind: "ok" | "warn" | "muted" | "info") {
  if (kind === "ok") return "border-emerald-300 bg-emerald-100 text-emerald-800";
  if (kind === "warn") return "border-amber-300 bg-amber-100 text-amber-800";
  if (kind === "info") return "border-blue-300 bg-blue-100 text-blue-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

function statusTone(status: string) {
  const s = String(status ?? "").toUpperCase();
  if (["AUTHORIZED", "PAID", "RECEIVED", "CONFIRMED"].includes(s)) return badgeTone("ok");
  if (["DRAFT", "PENDING", "SENT"].includes(s)) return badgeTone("info");
  if (["REJECTED", "CANCELLED", "DENIED"].includes(s)) return badgeTone("warn");
  return badgeTone("muted");
}

function docTypeLabel(v: string) {
  const x = String(v ?? "").toUpperCase();
  if (x === "NFCE") return "NFC-e";
  if (x === "NFE") return "NF-e";
  return x || "—";
}

function getPdvDocType(requested: string) {
  return String(requested ?? "").toUpperCase() === "NFE" ? "NFE" : "NFCE";
}

function paymentLabel(v: string) {
  const x = String(v ?? "").toUpperCase();
  const map: Record<string, string> = { CASH: "Dinheiro", PIX: "PIX", CARD: "Cartão", TRANSFER: "Transferência", OTHER: "À prazo" };
  return map[x] ?? (x || "—");
}

function timeAgo(sentAt: string | null) {
  if (!sentAt) return "";
  const d = new Date(sentAt).getTime();
  const now = Date.now();
  const min = Math.floor((now - d) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function brl(v: any) {
  return n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function prettyFieldName(v: string) {
  const s = String(v ?? "").trim();
  const map: Record<string, string> = {
    "client.name": "nome do cliente",
    "client.document": "documento do cliente",
    "client.document_or_walkin": "documento do cliente ou cliente balcão",
    "client.address.street": "logradouro",
    "client.address.number": "número",
    "client.address.district": "bairro",
    "client.address.city": "cidade",
    "client.address.state": "UF",
    "client.address.zip": "CEP",
    "client.ie": "IE do cliente",
    "client.im": "IM do cliente",
    "client.cityCodeIbge": "cMun IBGE",
    "company.document(CNPJ)": "CNPJ da empresa",
    "companyFiscal.legalName(razao social)": "razão social",
    "companyFiscal.tradeName(nome fantasia)": "nome fantasia",
    "companyFiscal.ie(IE)": "IE",
    "companyFiscal.crt(CRT)": "CRT",
    "companyFiscal.addressStreet": "logradouro da empresa",
    "companyFiscal.addressNumber": "número da empresa",
    "companyFiscal.addressDistrict": "bairro da empresa",
    "companyFiscal.addressCity": "cidade da empresa",
    "companyFiscal.addressState(UF)": "UF da empresa",
    "companyFiscal.addressZip(CEP)": "CEP da empresa",
    "companyFiscal.cityCodeIbge(cMun IBGE)": "cMun IBGE da empresa",
    "product": "produto",
    "product.unitId": "unidade do produto",
    "product.fiscal": "cadastro fiscal do produto",
    "product.fiscal.origin": "origem",
    "product.fiscal.ncm": "NCM",
    "product.fiscal.cfop": "CFOP",
    "product.fiscal.cest": "CEST",
    "product.fiscal.cst_or_csosn": "CST/CSOSN",
  };
  return map[s] ?? s;
}

// ---------------------------------------------------------------------------
// Error message builders
// ---------------------------------------------------------------------------

function buildCreateInvoiceErrorMessage(data: any) {
  const error = String(data?.error ?? "");
  const docType = String(data?.docType ?? "");

  if (error === "payment_required_before_fiscal")
    return "Receba o pagamento no PDV antes de criar o documento fiscal.";

  if (error === "client_fiscal_incomplete") {
    const missingClient = Array.isArray(data?.missingClient) ? data.missingClient : [];
    const fields = missingClient.map((x: string) => prettyFieldName(x)).join(", ");
    if (String(data?.docType ?? "").toUpperCase() === "NFE" && Number(data?.docDigitsLength ?? 0) === 11)
      return `Cliente CPF incompleto para NFE: ${fields || "dados obrigatórios ausentes"}.`;
    if (String(data?.docType ?? "").toUpperCase() === "NFE" && Number(data?.docDigitsLength ?? 0) === 14)
      return `Cliente CNPJ incompleto para NFE: ${fields || "dados obrigatórios ausentes"}.`;
    return `Cliente incompleto para ${docType || "o documento fiscal"}: ${fields || "dados obrigatórios ausentes"}.`;
  }

  if (error === "destinatario_incompleto") {
    const missing = Array.isArray(data?.missing) ? data.missing : [];
    const fields = missing.map((x: string) => prettyFieldName(x)).join(", ");
    if (String(data?.docType ?? "").toUpperCase() === "NFE" && data?.isCnpj)
      return `Destinatário PJ incompleto para NF-e: ${fields || "revise os dados principais"}.`;
    if (String(data?.docType ?? "").toUpperCase() === "NFE" && data?.isCpf)
      return `Destinatário PF incompleto para NF-e: ${fields || "revise nome e documento"}.`;
    return `Destinatário incompleto: ${fields || "revise os dados antes de emitir"}.`;
  }

  if (error === "itens_fiscais_incompletos") {
    const first = Array.isArray(data?.missingItems) ? data.missingItems[0] : null;
    const fields = Array.isArray(first?.missing) ? first.missing.map((x: string) => prettyFieldName(x)).join(", ") : "";
    return `Item sem base fiscal suficiente: ${first?.name ?? "item"}${fields ? ` (${fields})` : ""}.`;
  }

  if (error === "product_fiscal_incomplete") {
    const missingItems = Array.isArray(data?.missingItems) ? data.missingItems : [];
    if (!missingItems.length) return "Existem itens sem cadastro fiscal mínimo para emissão.";
    const first = missingItems[0];
    const prodName = String(first?.productName ?? first?.productId ?? "produto");
    const fields = Array.isArray(first?.missing) ? first.missing.map((x: string) => prettyFieldName(x)).join(", ") : "";
    const extra = missingItems.length > 1 ? ` + ${missingItems.length - 1} outro(s)` : "";
    return `Produto sem fiscal: ${prodName}${fields ? ` (${fields})` : ""}${extra}.`;
  }
  return String(data?.message ?? data?.error ?? "Erro ao criar documento fiscal");
}

function buildEmitInvoiceErrorMessage(data: any) {
  const error = String(data?.error ?? "");
  if (error === "emitente_incompleto") {
    const missing = Array.isArray(data?.missing) ? data.missing : [];
    const fields = missing.map((x: string) => prettyFieldName(x)).join(", ");
    return `Emitente incompleto: ${fields || "complete os dados fiscais da empresa"}.`;
  }
  if (error === "destinatario_incompleto") {
    const missing = Array.isArray(data?.missing) ? data.missing : [];
    const fields = missing.map((x: string) => prettyFieldName(x)).join(", ");
    return `Destinatário incompleto para emissão: ${fields || "revise os dados do cliente"}.`;
  }
  if (error === "itens_fiscais_incompletos")
    return "Existem itens sem base fiscal suficiente para emitir. Revise o fiscal do produto.";
  if (error === "provider_not_configured")
    return "Provider fiscal não configurado. Revise Configurações > Fiscal.";
  return String(data?.message ?? data?.error ?? "Erro ao emitir");
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

async function fetchPdvOrders(params: { q?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  const res = await fetch(`/api/pdv/orders?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar PDV");
  return data as { orders: any[] };
}

async function fetchPdvOrder(id: string) {
  const res = await fetch(`/api/pdv/orders/${id}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar pedido");
  return data as { order: any };
}


async function createAR(orderId: string) {
  const res = await fetch(`/api/ar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao criar AR");
  return data as { ok: boolean; ar: any; ars?: any[]; installments?: number };
}

async function receiveAR(arId: string) {
  const res = await fetch(`/api/accounts-receivable/${arId}/mark-paid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao receber");
  return data;
}

async function createInvoice(orderId: string, docType?: string, fiscalObservation?: string) {
  const res = await fetch("/api/fiscal/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      orderId,
      docType: docType || undefined,
      fiscalObservation: String(fiscalObservation ?? "").trim() || undefined,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(buildCreateInvoiceErrorMessage(data), data, res.status);
  return data as any;
}

async function emitInvoice(id: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/emit`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(buildEmitInvoiceErrorMessage(data), data, res.status);
  return data;
}

async function consultInvoice(id: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/consult`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao consultar documento");
  return data;
}

async function downloadInvoiceArtifacts(id: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/download`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao baixar XML/PDF");
  return data;
}

async function cancelInvoice(id: string, reason: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao cancelar documento");
  return data;
}

async function confirmOrder(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}/confirm`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao confirmar");
  return data;
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

async function returnToSeller(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}/return-to-seller`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao devolver pedido");
  return data;
}

async function fetchFiscalInvoices() {
  const res = await fetch("/api/fiscal/invoices?take=100");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar notas");
  return data as { rows: any[] };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionCard(props: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(Boolean(props.defaultOpen));
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={`rounded-xl border bg-background shadow-sm ${props.className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <CollapsibleTrigger asChild>
          <button className="flex flex-1 items-center gap-2 text-left">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm font-semibold">{props.title}</span>
          </button>
        </CollapsibleTrigger>
        {props.rightSlot}
      </div>
      <CollapsibleContent>
        <div className="border-t bg-muted/20 px-4 py-4">{props.children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground truncate">{label}</div>
          <div className="text-lg font-bold tabular-nums leading-tight">{value}</div>
          {sub ? <div className="text-[11px] text-muted-foreground truncate">{sub}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function StepIndicator({ steps }: { steps: Array<{ label: string; done: boolean; active: boolean }> }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          <div className="flex items-center gap-1.5">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                s.done
                  ? "bg-emerald-500 text-white"
                  : s.active
                    ? "bg-blue-500 text-white ring-2 ring-blue-200"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${s.active ? "text-blue-700" : s.done ? "text-emerald-700" : "text-muted-foreground"}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px flex-1 min-w-[16px] ${s.done ? "bg-emerald-300" : "bg-border"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const s = String(status ?? "").toUpperCase();
  const tone = statusTone(s);
  const label = s === "AUTHORIZED" ? "Autorizada" : s === "CANCELLED" ? "Cancelada" : s === "DRAFT" ? "Rascunho" : s === "EMITTED" ? "Emitida" : s === "REJECTED" ? "Rejeitada" : s || "—";
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function PaymentStatusBadge({ status }: { status: string }) {
  const s = String(status ?? "").toUpperCase();
  if (s === "PAID") return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTone("ok")}`}>Pago</span>;
  if (s === "PENDING") return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTone("info")}`}>Pendente</span>;
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTone("muted")}`}>—</span>;
}

// ---------------------------------------------------------------------------
// Tab: Caixa (main queue + detail)
// ---------------------------------------------------------------------------

function CaixaTab() {
  const qc = useQueryClient();
  const sp = useSearchParams();
  const [q, setQ] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [fiscalObservation, setFiscalObservation] = React.useState("");
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReasonKey, setCancelReasonKey] = React.useState("CLIENTE_DESISTIU");
  const [cancelReasonCustom, setCancelReasonCustom] = React.useState("");
  const [showRules, setShowRules] = React.useState(false);
  const listQ = useQuery({
    queryKey: ["pdv-orders", { q }],
    queryFn: () => fetchPdvOrders({ q: q.trim() || undefined }),
  });
  const orders = listQ.data?.orders ?? [];

  const inutQ = useQuery({
    queryKey: ["pending-inutilizations"],
    queryFn: fetchPendingInutilizations,
    refetchInterval: 60_000,
  });
  const pendingInut = inutQ.data?.pending ?? [];

  const inutMut = useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) => postInutilize(invoiceId, reason),
    onSuccess: async () => {
      toast.success("Numeração inutilizada com sucesso.");
      await qc.invalidateQueries({ queryKey: ["pending-inutilizations"] });
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao inutilizar"),
  });

  const orderQ = useQuery({
    queryKey: ["pdv-order", { id: selectedId }],
    queryFn: () => fetchPdvOrder(String(selectedId)),
    enabled: Boolean(selectedId),
  });
  const order = orderQ.data?.order ?? null;

  const cashSessionQ = useQuery({
    queryKey: ["cash-session"],
    queryFn: async () => {
      const res = await fetch("/api/cash/session");
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return data?.cashSession ?? null;
    },
  });
  const cashOpen = Boolean(cashSessionQ.data);

  const [invoiceId, setInvoiceId] = React.useState<string>("");
  React.useEffect(() => {
    setInvoiceId("");
    setFiscalObservation("");
    setCancelOpen(false);
    setCancelReasonKey("CLIENTE_DESISTIU");
    setCancelReasonCustom("");
  }, [selectedId]);

  React.useEffect(() => {
    const openId = String(sp?.get("open") ?? "").trim();
    if (!openId) return;
    if (selectedId === openId) return;
    setSelectedId(openId);
  }, [sp, selectedId]);

  const total = React.useMemo(() => {
    const items = order?.items ?? [];
    return items.reduce((s: number, it: any) => s + n(it.total), 0);
  }, [order]);

  // --- KPI summaries ---
  const kpis = React.useMemo(() => {
    const totalOrders = orders.length;
    const totalValue = orders.reduce((s: number, o: any) => s + n(o.total), 0);
    const pendingPayment = orders.filter((o: any) => String(o.arStatus ?? "").toUpperCase() !== "PAID").length;
    const pendingFiscal = orders.filter((o: any) => {
      const invSt = String(o.lastInvoiceStatus ?? "").toUpperCase();
      return invSt !== "AUTHORIZED";
    }).length;
    return { totalOrders, totalValue, pendingPayment, pendingFiscal };
  }, [orders]);

  // Queue columns removed — now using compact cards instead of DataTable

  // --- Order detail computed ---
  const requestedDocType = String(order?.requestedDocType ?? "").toUpperCase();
  const pdvDocType = getPdvDocType(requestedDocType);
  const lastInv = order?.lastInvoice ?? null;
  const effectiveInvoiceId = String(invoiceId || lastInv?.id || "");
  const lastInvStatus = String(lastInv?.status ?? "");
  const hasInvoice = Boolean(effectiveInvoiceId);
  const isAuthorizedInvoice = String(lastInvStatus).toUpperCase() === "AUTHORIZED";
  const isCancelledInvoice = String(lastInvStatus).toUpperCase() === "CANCELLED";
  const canCancelInvoice = hasInvoice && isAuthorizedInvoice;
  const isNfe = requestedDocType === "NFE";

  const paymentMethod = String(order?.paymentMethod ?? "").toUpperCase();
  const isCarteira = paymentMethod === "OTHER" || paymentMethod === "TRANSFER"; // à prazo: pagamento em Recebimentos, não no PDV
  const arStatus = String(order?.ar?.status ?? "");
  const canCreateAR = Boolean(order) && !order?.ar;
  const canReceive = !isCarteira && Boolean(order?.ar?.id) && arStatus === "PENDING" && cashOpen;
  const isPaid = arStatus === "PAID";
  const canConfirm = isPaid && (!isNfe || lastInvStatus === "AUTHORIZED");

  const draftStepDone = Boolean(lastInv?.id);
  const emissionPending = lastInvStatus.toUpperCase() === "PENDING";
  const emissionStepDone = ["AUTHORIZED", "EMITTED"].includes(String(lastInvStatus).toUpperCase());

  const stepperSteps = [
    { label: "Pagamento", done: isPaid, active: !isPaid },
    { label: "Documento", done: draftStepDone, active: isPaid && !draftStepDone },
    { label: "Emissão", done: emissionStepDone, active: isPaid && draftStepDone && !emissionStepDone && !emissionPending },
    { label: "Confirmação", done: false, active: canConfirm },
  ];

  const clientDoc = String(order?.client?.document ?? "").trim();
  const clientPhone = String(order?.client?.phone ?? "").trim();
  const clientEmail = String(order?.client?.email ?? "").trim();
  const installmentsLabel = Number(order?.installments ?? 0) > 1 ? `${Number(order?.installments)}x` : "à vista";
  const showCardBrand = String(order?.paymentMethod ?? "").toUpperCase() === "CARD";
  const paymentDisplay = `${paymentLabel(String(order?.paymentMethod ?? ""))}${showCardBrand && order?.cardBrand ? ` · ${String(order.cardBrand)}` : ""} · ${installmentsLabel}`;
  const clientAddressDisplay = [
    order?.client?.addressStreet,
    order?.client?.addressNumber,
    order?.client?.addressDistrict,
    order?.client?.addressCity,
    order?.client?.addressState,
  ].filter(Boolean).join(", ");

  const fiscalIssues = React.useMemo(() => {
    const issues: string[] = [];
    if (!order?.client?.name) issues.push("Cliente sem nome.");
    if (requestedDocType === "NFE" && !clientDoc) issues.push("NF-e sem documento do destinatário.");
    if (requestedDocType === "NFE" && clientDoc && clientDoc.replace(/\D/g, "").length === 14 && !clientAddressDisplay) issues.push("NF-e para CNPJ: endereço do destinatário incompleto.");
    (order?.items ?? []).forEach((it: any) => {
      const f = it?.product?.fiscal ?? null;
      if (!f?.ncm || !f?.cfop || (!f?.cst && !f?.csosn))
        issues.push(`Produto ${it?.product?.name ?? it?.description ?? it?.productId ?? "sem nome"} com fiscal incompleto.`);
    });
    return Array.from(new Set(issues));
  }, [order, requestedDocType, clientDoc, clientAddressDisplay]);

  const createArMut = useMutation({
    mutationFn: () => createAR(String(selectedId)),
    onSuccess: async (data: any) => {
      const n = data?.installments ?? data?.ars?.length ?? 1;
      toast.success(n > 1 ? `${n} recebíveis criados (parcelado). Veja em Carteira ou Recebimentos.` : "Recebível criado. Veja em Comercial → Venda (Carteira) ou Financeiro → Recebimentos.");
      await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
      await qc.invalidateQueries({ queryKey: ["venda-panel"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const receiveMut = useMutation({
    mutationFn: () => receiveAR(String(order?.ar?.id ?? "")),
    onSuccess: async () => {
      toast.success("Pagamento registrado e lançado no caixa.");
      await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
      if (selectedId) {
        try {
          await createInvoice(String(selectedId), pdvDocType === "NFCE" ? "NFCE" : undefined, fiscalObservation);
          toast.success("Documento fiscal criado. Emita em Fiscal → Documentos ou use o botão abaixo.");
          await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
        } catch (e: any) {
          toast.error(e?.message ?? "Erro ao criar nota fiscal");
        }
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const createInvMut = useMutation({
    mutationFn: async () => {
      const docType = pdvDocType === "NFCE" ? "NFCE" : undefined;
      if (pdvDocType === "NFE") {
        throw new Error("Este pedido está marcado para NF-e. Emita a NF-e em Fiscal → Documentos Fiscais.");
      }
      const d = await createInvoice(String(selectedId), docType, fiscalObservation);
      const id = String(d?.invoice?.id ?? "");
      if (!id) throw new Error("invoice_id_missing");
      setInvoiceId(id);
      await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
      return id;
    },
    onSuccess: () => toast.success("Documento fiscal criado (DRAFT)."),
    onError: (e: any) => toast.error(e instanceof ApiError ? e.message : String(e?.message ?? "Erro")),
  });

  const emitInvMut = useMutation({
    mutationFn: () => emitInvoice(effectiveInvoiceId),
    onSuccess: async () => {
      toast.success("Emissão disparada (veja status em Fiscal > Documentos).");
      await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
    },
    onError: (e: any) => toast.error(e instanceof ApiError ? e.message : String(e?.message ?? "Erro")),
  });

  const consultInvMut = useMutation({
    mutationFn: () => consultInvoice(effectiveInvoiceId),
    onSuccess: async () => {
      toast.success("Status fiscal atualizado.");
      await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao consultar documento"),
  });

  const downloadInvMut = useMutation({
    mutationFn: () => downloadInvoiceArtifacts(effectiveInvoiceId),
    onSuccess: async () => {
      toast.success("XML/PDF baixados e vinculados ao documento.");
      await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao baixar XML/PDF"),
  });

  const resolvedCancelReason = cancelReasonKey === "OUTRO"
    ? cancelReasonCustom
    : (CANCEL_REASONS.find((r) => r.key === cancelReasonKey)?.text ?? "");

  const cancelInvMut = useMutation({
    mutationFn: () => cancelInvoice(effectiveInvoiceId, resolvedCancelReason),
    onSuccess: async () => {
      toast.success("Cancelamento solicitado.");
      setCancelOpen(false);
      await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cancelar documento"),
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmOrder(String(selectedId)),
    onSuccess: async () => {
      toast.success("Venda confirmada. OP criada e estoque reservado.");
      setSelectedId(null);
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const canReturnToSeller = Boolean(order) && ["DRAFT", "OPEN"].includes(String(order?.status)) && !isAuthorizedInvoice;

  const returnMut = useMutation({
    mutationFn: () => returnToSeller(String(selectedId)),
    onSuccess: async () => {
      toast.success("Pedido devolvido ao vendedor.");
      setSelectedId(null);
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao devolver"),
  });


  return (
    <>
      {!cashOpen && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 shrink-0" />
            <span className="text-sm font-medium">Abra o caixa para poder receber pagamentos e vender.</span>
          </div>
          <Button size="sm" variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-100" asChild>
            <Link href="/financeiro/caixa">Abrir caixa</Link>
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={<ShoppingCart className="h-5 w-5 text-muted-foreground" />} label="Pedidos no caixa" value={kpis.totalOrders} />
        <KpiCard icon={<DollarSign className="h-5 w-5 text-muted-foreground" />} label="Total" value={brl(kpis.totalValue)} />
        <KpiCard icon={<Clock className="h-5 w-5 text-amber-500" />} label="Pend. pagamento" value={kpis.pendingPayment} />
        <KpiCard icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} label="Pend. fiscal" value={kpis.pendingFiscal} />
      </div>

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

      {/* Queue + Detail */}
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* Left: Compact Queue */}
        <Card className="lg:sticky lg:top-[4.5rem] lg:self-start lg:max-h-[calc(100vh-5.5rem)] lg:overflow-hidden lg:flex lg:flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Fila</CardTitle>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{orders.length}</span>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => qc.invalidateQueries({ queryKey: ["pdv-orders"] })}>
                <RefreshCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-2 overflow-y-auto pt-0 pb-3">
            <Input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-xs" />
            {orders.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Nenhum pedido no caixa.</div>
            ) : (
              orders.map((r: any) => {
                const active = r.id === selectedId;
                const dt = String(r.requestedDocType ?? "").toUpperCase();
                const invSt = String(r.lastInvoiceStatus ?? "").toUpperCase();
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded-xl border p-2.5 text-left transition ${
                      active
                        ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                        : "bg-background hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] text-muted-foreground block truncate">{r.number ?? r.id.slice(-8)}</span>
                        <span className="text-xs font-semibold truncate block">{r.client?.name ?? "Balcão"}</span>
                      </div>
                      <span className="text-xs font-bold tabular-nums shrink-0">{brl(r.total)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <PaymentStatusBadge status={r.arStatus ?? ""} />
                      <span className={`inline-flex rounded-full border px-1.5 py-0 text-[10px] font-medium ${dt === "NFE" ? badgeTone("warn") : badgeTone("info")}`}>
                        {docTypeLabel(dt)}
                      </span>
                      {invSt && (
                        <InvoiceStatusBadge status={invSt} />
                      )}
                      {r.sentToCashierAt && (
                        <span className="text-[10px] text-muted-foreground">{timeAgo(r.sentToCashierAt)}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {paymentLabel(String(r.paymentMethod ?? ""))}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Right: Detail (fluid) */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalhe do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {!selectedId ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed bg-muted/20 p-8">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-12 w-12 rounded-full border bg-background" />
                  <div className="text-sm font-medium">Selecione um pedido na fila</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    O detalhe do pedido e o documento fiscal aparecem aqui.
                  </div>
                </div>
              </div>
            ) : orderQ.isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : !order ? (
              <div className="text-sm text-muted-foreground">Pedido não encontrado.</div>
            ) : (
              <>
                {/* Order header */}
                <div className="rounded-xl border p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Pedido</div>
                      <div className="text-base font-bold">{order.number ?? order.id}</div>
                      <div className="text-sm text-muted-foreground">{order.client?.name ?? "Cliente não informado"}</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${isNfe ? badgeTone("warn") : badgeTone("info")}`}>
                        {docTypeLabel(requestedDocType)}
                      </span>
                      {isCancelledInvoice && (
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badgeTone("warn")}`}>
                          Doc cancelado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stepper */}
                  <StepIndicator steps={stepperSteps} />

                  {/* Rules toggle */}
                  <button
                    onClick={() => setShowRules((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <CircleHelp className="h-3.5 w-3.5" />
                    {showRules ? "Ocultar regras" : "Ver regras do caixa"}
                  </button>
                  {showRules && (
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      Fluxo: pagar &rarr; criar DRAFT &rarr; emitir &rarr; consultar até autorização &rarr; confirmar venda.
                    </div>
                  )}
                </div>

                {/* Cliente */}
                <SectionCard
                  title="Cliente"
                  defaultOpen
                  rightSlot={<span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${fiscalIssues.length ? badgeTone("warn") : badgeTone("ok")}`}>{fiscalIssues.length ? "Atenção" : "OK"}</span>}
                >
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <div><span className="text-muted-foreground">Nome:</span> {order?.client?.name ?? "—"}</div>
                    <div><span className="text-muted-foreground">Documento:</span> {clientDoc || "—"}</div>
                    <div><span className="text-muted-foreground">Telefone:</span> {clientPhone || "—"}</div>
                    <div><span className="text-muted-foreground">Email:</span> {clientEmail || "—"}</div>
                    <div className="md:col-span-2"><span className="text-muted-foreground">Endereço:</span> {clientAddressDisplay || "—"}</div>
                  </div>
                </SectionCard>

                {/* Pagamento */}
                <SectionCard
                  title="Pagamento"
                  defaultOpen
                  rightSlot={<PaymentStatusBadge status={arStatus || ""} />}
                >
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <div><span className="text-muted-foreground">Forma:</span> {paymentDisplay}</div>
                    <div><span className="text-muted-foreground">Recebível:</span> {order.ar ? `${order.ar.status} • ${brl(order.ar.amount)}` : "—"}</div>
                    <div><span className="text-muted-foreground">Obs. pagamento:</span> {order.paymentNote ?? "—"}</div>
                  </div>
                  {!isPaid && (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => createArMut.mutate()}
                          disabled={!canCreateAR || createArMut.isPending}
                          title="Usa vencimento e parcelas definidos no pedido pelo vendedor."
                        >
                          {createArMut.isPending ? "Criando..." : "Criar recebível"}
                        </Button>
                        {!isCarteira && (
                          <Button
                            size="sm"
                            onClick={() => receiveMut.mutate()}
                            disabled={!canReceive || receiveMut.isPending}
                            title={!cashOpen ? "Abra o caixa para receber (Financeiro → Abrir/Fechar Caixa)." : undefined}
                          >
                            {receiveMut.isPending ? "Recebendo..." : "Receber pagamento"}
                          </Button>
                        )}
                      </div>
                      {isCarteira && order?.ar ? (
                        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
                          <strong>Venda à prazo.</strong> Registre o pagamento em{" "}
                          <Link href="/financeiro/recebimentos" className="font-medium underline hover:no-underline">Financeiro → Recebimentos</Link>
                          {" "}quando o cliente pagar. A nota fiscal será emitida automaticamente ao receber.
                        </div>
                      ) : !isCarteira ? (
                        <p className="text-xs text-muted-foreground">Será emitida nota fiscal ao receber o pagamento.</p>
                      ) : null}
                    </div>
                  )}
                </SectionCard>

                {/* Fiscal */}
                <SectionCard
                  title="Nota Fiscal"
                  defaultOpen
                  className="border-primary/20 bg-primary/[0.04]"
                  rightSlot={
                    lastInv
                      ? <InvoiceStatusBadge status={lastInvStatus} />
                      : <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${badgeTone("muted")}`}>Sem documento</span>
                  }
                >
                  <div className="space-y-4">
                    <div className="grid gap-2 md:grid-cols-2 text-sm">
                      <div><span className="text-muted-foreground">Tipo:</span> {docTypeLabel(pdvDocType)}</div>
                      <div><span className="text-muted-foreground">Status:</span> {lastInv ? `${docTypeLabel(lastInv.docType)} · ${lastInv.status}` : "—"}</div>
                    </div>

                    <div>
                      <Label htmlFor="fiscalObservation" className="text-xs">Observação da nota (opcional)</Label>
                      <Input
                        id="fiscalObservation"
                        value={fiscalObservation}
                        onChange={(e) => setFiscalObservation(e.target.value)}
                        placeholder="Preencha só quando o cliente pedir"
                        className="h-8 text-sm"
                      />
                    </div>

                    {fiscalIssues.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="mb-1 text-xs font-semibold text-amber-700">Pendências encontradas</div>
                        <div className="space-y-0.5 text-xs text-amber-700">
                          {fiscalIssues.map((issue) => <div key={issue}>• {issue}</div>)}
                        </div>
                      </div>
                    )}

                    {requestedDocType === "NFE" && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                        Este pedido está marcado para NF-e. Emita a NF-e em <span className="font-semibold">Fiscal → Documentos Fiscais</span>.
                      </div>
                    )}

                    {/* Progressive fiscal actions */}
                    {!isPaid ? (
                      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        Aguardando pagamento para habilitar ações fiscais.
                      </div>
                    ) : requestedDocType === "NFE" ? (
                      <div className="space-y-2">
                        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                          O PDV não emite NF-e. Use Fiscal → Documentos Fiscais para emitir este documento.
                        </div>
                        <div className="flex gap-2">
                          {effectiveInvoiceId ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/fiscal/documentos/${effectiveInvoiceId}`}>Abrir documento</Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" asChild>
                              <Link href="/fiscal/documentos">Ir para Documentos Fiscais</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : !draftStepDone ? (
                      <Button className="w-full" onClick={() => createInvMut.mutate()} disabled={createInvMut.isPending}>
                        {createInvMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {createInvMut.isPending ? "Criando documento..." : "Criar NFC-e"}
                      </Button>
                    ) : emissionPending ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-amber-700">
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                          Emissão em processamento — aguardando SEFAZ
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => consultInvMut.mutate()} disabled={!effectiveInvoiceId || consultInvMut.isPending}>
                            {consultInvMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
                            Consultar status
                          </Button>
                        </div>
                      </div>
                    ) : !emissionStepDone ? (
                      <div className="space-y-2">
                        <Button className="w-full" onClick={() => emitInvMut.mutate()} disabled={!effectiveInvoiceId || emitInvMut.isPending}>
                          {emitInvMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {emitInvMut.isPending ? "Emitindo..." : "Emitir NFC-e"}
                        </Button>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => consultInvMut.mutate()} disabled={!effectiveInvoiceId || consultInvMut.isPending}>
                            {consultInvMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
                            Consultar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-700">
                          <CheckCircle className="h-4 w-4 shrink-0" />
                          Documento autorizado
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => consultInvMut.mutate()} disabled={!effectiveInvoiceId || consultInvMut.isPending}>
                            {consultInvMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />}
                            Consultar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => downloadInvMut.mutate()} disabled={!effectiveInvoiceId || !isAuthorizedInvoice || downloadInvMut.isPending}>
                            {downloadInvMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-1.5 h-3.5 w-3.5" />}
                            XML/PDF
                          </Button>
                          {effectiveInvoiceId && (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/fiscal/documentos/${effectiveInvoiceId}`}>Abrir doc</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Cancel / Return actions */}
                    {(canCancelInvoice || canReturnToSeller) && (
                      <div className="border-t pt-3 flex flex-wrap gap-2">
                        {canCancelInvoice && (
                          <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)} disabled={cancelInvMut.isPending}>
                            <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancelar documento
                          </Button>
                        )}
                        {canReturnToSeller && (
                          <Button size="sm" variant="outline" onClick={() => returnMut.mutate()} disabled={returnMut.isPending}>
                            {returnMut.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Undo2 className="mr-1.5 h-3.5 w-3.5" />}
                            Devolver ao vendedor
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </SectionCard>

                {/* Itens */}
                <SectionCard title="Itens" defaultOpen rightSlot={<span className="text-xs text-muted-foreground">{order.items?.length ?? 0} item(ns)</span>}>
                  <div className="rounded-md border max-h-[280px] overflow-y-auto">
                    {(order.items ?? []).map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm border-b last:border-b-0">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{it.product?.name ?? it.description ?? it.productId}</div>
                          <div className="text-xs text-muted-foreground">
                            {n(it.quantity ?? it.qty)} x {brl(it.unitPrice ?? it.price)}
                          </div>
                        </div>
                        <div className="tabular-nums font-medium shrink-0 ml-3">{brl(it.total)}</div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-3 py-3 bg-muted/30">
                      <div className="text-sm font-semibold">Total</div>
                      <div className="text-3xl font-bold tracking-tight tabular-nums">{brl(total)}</div>
                    </div>
                  </div>
                </SectionCard>

                {/* Confirm sale or blocker for NFE */}
                {canConfirm ? (
                  <Button
                    className="w-full h-11 text-sm font-semibold shadow-sm"
                    size="lg"
                    onClick={() => confirmMut.mutate()}
                    disabled={confirmMut.isPending}
                  >
                    {confirmMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirmar venda
                  </Button>
                ) : isPaid && isNfe && lastInvStatus !== "AUTHORIZED" ? (
                  <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Este pedido exige NF-e. Emita e acompanhe a autorização em Fiscal → Documentos Fiscais (status atual: {lastInvStatus || "—"}).
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar documento fiscal</DialogTitle>
            <DialogDescription>
              Use o cancelamento somente quando o documento já estiver autorizado e o cliente realmente solicitar o estorno/cancelamento da operação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <select
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={cancelReasonKey}
                onChange={(e) => setCancelReasonKey(e.target.value)}
              >
                {CANCEL_REASONS.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </div>
            {cancelReasonKey === "OUTRO" && (
              <div className="space-y-1.5">
                <Label>Justificativa (mín. 15 caracteres)</Label>
                <Input
                  value={cancelReasonCustom}
                  onChange={(e) => setCancelReasonCustom(e.target.value)}
                  placeholder="Descreva o motivo do cancelamento..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={() => cancelInvMut.mutate()}
              disabled={cancelInvMut.isPending || !effectiveInvoiceId || resolvedCancelReason.length < 15}
            >
              {cancelInvMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab: Notas Fiscais
// ---------------------------------------------------------------------------

function NotasFiscaisTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<"all" | "NFE" | "NFCE">("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "DRAFT" | "AUTHORIZED" | "CANCELLED">("all");

  const invoicesQ = useQuery({
    queryKey: ["pdv-invoices"],
    queryFn: fetchFiscalInvoices,
  });
  const allRows = invoicesQ.data?.rows ?? [];

  const filtered = React.useMemo(() => {
    let rows = allRows;
    if (filter !== "all") rows = rows.filter((r: any) => String(r.docType ?? "").toUpperCase() === filter);
    if (statusFilter !== "all") rows = rows.filter((r: any) => String(r.status ?? "").toUpperCase() === statusFilter);
    return rows;
  }, [allRows, filter, statusFilter]);

  const summary = React.useMemo(() => {
    const total = allRows.length;
    const authorized = allRows.filter((r: any) => String(r.status).toUpperCase() === "AUTHORIZED").length;
    const draft = allRows.filter((r: any) => String(r.status).toUpperCase() === "DRAFT").length;
    const cancelled = allRows.filter((r: any) => String(r.status).toUpperCase() === "CANCELLED").length;
    return { total, authorized, draft, cancelled };
  }, [allRows]);

  const consultMut = useMutation({
    mutationFn: consultInvoice,
    onSuccess: async () => {
      toast.success("Status atualizado.");
      await qc.invalidateQueries({ queryKey: ["pdv-invoices"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const downloadMut = useMutation({
    mutationFn: downloadInvoiceArtifacts,
    onSuccess: () => toast.success("XML/PDF baixados."),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const cols: Column<any>[] = [
    {
      key: "createdAt",
      header: "Data",
      cell: (r) => <span className="text-xs">{new Date(r.createdAt).toLocaleString("pt-BR")}</span>,
    },
    {
      key: "docType",
      header: "Tipo",
      cell: (r) => (
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${String(r.docType).toUpperCase() === "NFE" ? badgeTone("warn") : badgeTone("info")}`}>
          {docTypeLabel(r.docType)}
        </span>
      ),
    },
    {
      key: "number",
      header: "Número",
      cell: (r) => <span className="text-sm font-medium tabular-nums">{r.number ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <InvoiceStatusBadge status={r.status} />,
    },
    {
      key: "key",
      header: "Chave",
      cell: (r) => <span className="text-xs text-muted-foreground font-mono truncate max-w-[180px] block">{r.key ? `...${String(r.key).slice(-12)}` : "—"}</span>,
    },
    {
      key: "actions",
      header: "Ações",
      cell: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => consultMut.mutate(r.id)} disabled={consultMut.isPending}>
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => downloadMut.mutate(r.id)}
            disabled={downloadMut.isPending || String(r.status).toUpperCase() !== "AUTHORIZED"}
          >
            <FileDown className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
            <Link href={`/fiscal/documentos/${r.id}`}>
              <FileText className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={<FileText className="h-5 w-5 text-muted-foreground" />} label="Total de notas" value={summary.total} />
        <KpiCard icon={<Check className="h-5 w-5 text-emerald-500" />} label="Autorizadas" value={summary.authorized} />
        <KpiCard icon={<Clock className="h-5 w-5 text-blue-500" />} label="Rascunhos" value={summary.draft} />
        <KpiCard icon={<Ban className="h-5 w-5 text-amber-500" />} label="Canceladas" value={summary.cancelled} />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Documentos Fiscais</CardTitle>
            <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["pdv-invoices"] })}>
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["all", "NFE", "NFCE"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setFilter(v)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${filter === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "all" ? "Todos" : docTypeLabel(v)}
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(["all", "DRAFT", "AUTHORIZED", "CANCELLED"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setStatusFilter(v)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${statusFilter === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "all" ? "Todos" : v === "DRAFT" ? "Rascunho" : v === "AUTHORIZED" ? "Autorizadas" : "Canceladas"}
                </button>
              ))}
            </div>
          </div>
          <DataTable
            rows={filtered}
            columns={cols}
            rowKey={(r) => r.id}
            emptyTitle="Sem documentos"
            emptyHint="Nenhum documento fiscal encontrado."
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Resumo do Dia
// ---------------------------------------------------------------------------

function ResumoTab() {
  const listQ = useQuery({
    queryKey: ["pdv-orders", {}],
    queryFn: () => fetchPdvOrders({}),
  });
  const orders = listQ.data?.orders ?? [];

  const invoicesQ = useQuery({
    queryKey: ["pdv-invoices"],
    queryFn: fetchFiscalInvoices,
  });
  const invoices = invoicesQ.data?.rows ?? [];

  const stats = React.useMemo(() => {
    const totalOrders = orders.length;
    const totalValue = orders.reduce((s: number, o: any) => s + n(o.total), 0);
    const paidOrders = orders.filter((o: any) => String(o.arStatus ?? "").toUpperCase() === "PAID").length;
    const unpaidOrders = totalOrders - paidOrders;

    const byPaymentMethod: Record<string, { count: number; total: number }> = {};
    for (const o of orders) {
      const method = paymentLabel(String(o.paymentMethod ?? "OTHER"));
      if (!byPaymentMethod[method]) byPaymentMethod[method] = { count: 0, total: 0 };
      byPaymentMethod[method].count++;
      byPaymentMethod[method].total += n(o.total);
    }

    const invoiceAuthorized = invoices.filter((i: any) => String(i.status).toUpperCase() === "AUTHORIZED").length;
    const invoiceDraft = invoices.filter((i: any) => String(i.status).toUpperCase() === "DRAFT").length;
    const invoiceCancelled = invoices.filter((i: any) => String(i.status).toUpperCase() === "CANCELLED").length;

    return { totalOrders, totalValue, paidOrders, unpaidOrders, byPaymentMethod, invoiceAuthorized, invoiceDraft, invoiceCancelled };
  }, [orders, invoices]);

  const paymentMethods = Object.entries(stats.byPaymentMethod).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={<ShoppingCart className="h-5 w-5 text-muted-foreground" />} label="Total de pedidos" value={stats.totalOrders} />
        <KpiCard icon={<DollarSign className="h-5 w-5 text-emerald-500" />} label="Valor total" value={brl(stats.totalValue)} />
        <KpiCard icon={<Check className="h-5 w-5 text-emerald-500" />} label="Pagos" value={stats.paidOrders} sub={`${stats.unpaidOrders} pendente(s)`} />
        <KpiCard icon={<Receipt className="h-5 w-5 text-blue-500" />} label="Notas autorizadas" value={stats.invoiceAuthorized} sub={`${stats.invoiceDraft} rascunho(s)`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Vendas por forma de pagamento */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vendas por Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {paymentMethods.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Sem dados ainda.</div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map(([method, data]) => {
                  const pct = stats.totalValue > 0 ? (data.total / stats.totalValue) * 100 : 0;
                  return (
                    <div key={method} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{method}</span>
                        <span className="tabular-nums text-muted-foreground">{data.count} venda(s) · {brl(data.total)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status fiscal */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Status das Notas Fiscais</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-emerald-50 p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-700 tabular-nums">{stats.invoiceAuthorized}</div>
                  <div className="text-xs text-emerald-600">Autorizadas</div>
                </div>
                <div className="rounded-lg border bg-blue-50 p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700 tabular-nums">{stats.invoiceDraft}</div>
                  <div className="text-xs text-blue-600">Rascunhos</div>
                </div>
                <div className="rounded-lg border bg-amber-50 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-700 tabular-nums">{stats.invoiceCancelled}</div>
                  <div className="text-xs text-amber-600">Canceladas</div>
                </div>
              </div>

              {invoices.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Taxa de autorização</div>
                  <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex">
                    {stats.invoiceAuthorized > 0 && (
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${(stats.invoiceAuthorized / invoices.length) * 100}%` }}
                      />
                    )}
                    {stats.invoiceDraft > 0 && (
                      <div
                        className="h-full bg-blue-400 transition-all"
                        style={{ width: `${(stats.invoiceDraft / invoices.length) * 100}%` }}
                      />
                    )}
                    {stats.invoiceCancelled > 0 && (
                      <div
                        className="h-full bg-amber-400 transition-all"
                        style={{ width: `${(stats.invoiceCancelled / invoices.length) * 100}%` }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{invoices.length} nota(s) no total</span>
                    <span>{stats.invoiceAuthorized > 0 ? `${Math.round((stats.invoiceAuthorized / invoices.length) * 100)}%` : "0%"} autorizadas</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function PdvPageContent() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="PDV"
        subtitle="Ponto de venda: fila de pedidos, receber pagamento, emitir nota e confirmar. O valor recebido é lançado no caixa (abra o caixa em Financeiro → Abrir/Fechar Caixa)."
      />

      <Tabs defaultValue="caixa" className="w-full">
        <TabsList>
          <TabsTrigger value="caixa" className="gap-1.5">
            <CreditCard className="h-4 w-4" /> Fila e vendas
          </TabsTrigger>
          <TabsTrigger value="notas" className="gap-1.5">
            <FileText className="h-4 w-4" /> Notas Fiscais
          </TabsTrigger>
          <TabsTrigger value="resumo" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Resumo do Dia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="caixa">
          <CaixaTab />
        </TabsContent>
        <TabsContent value="notas">
          <NotasFiscaisTab />
        </TabsContent>
        <TabsContent value="resumo">
          <ResumoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PdvPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6 p-6">
          <PageHeader title="PDV" />
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      }
    >
      <PdvPageContent />
    </React.Suspense>
  );
}
