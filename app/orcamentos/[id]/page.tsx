"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2, FileText, MessageCircle, Copy, Search, Plus,
  Trash2, Package, ChevronDown, ChevronRight, ArrowLeft,
  ShoppingCart, Clock, AlertTriangle, Send,
} from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ptQuoteStatus(s: any) {
  const x = String(s ?? "").toUpperCase();
  const map: Record<string, string> = {
    DRAFT: "Rascunho",
    SENT: "Enviado",
    APPROVED: "Aprovado",
    REJECTED: "Rejeitado",
    EXPIRED: "Vencido",
    CANCELED: "Cancelado",
  };
  return map[x] ?? (x || "—");
}

function statusTone(s: string) {
  const x = String(s).toUpperCase();
  if (x === "DRAFT") return "border-slate-300 bg-slate-100 text-slate-700";
  if (x === "SENT") return "border-blue-300 bg-blue-100 text-blue-800";
  if (x === "APPROVED") return "border-emerald-300 bg-emerald-100 text-emerald-800";
  if (x === "REJECTED" || x === "CANCELED") return "border-red-300 bg-red-100 text-red-800";
  if (x === "EXPIRED") return "border-amber-300 bg-amber-100 text-amber-800";
  return "border-slate-300 bg-slate-100 text-slate-700";
}

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

async function fetchQuote(id: string) {
  const res = await fetch(`/api/quotes/${id}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar orçamento");
  return data;
}

async function fetchProducts() {
  const res = await fetch(`/api/products`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar produtos");
  return data as { products: any[] };
}

async function addQuoteItem(quoteId: string, payload: any) {
  const res = await fetch(`/api/quotes/${quoteId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao adicionar item");
  return data;
}

async function removeQuoteItem(quoteId: string, itemId: string) {
  const res = await fetch(`/api/quotes/${quoteId}/items?itemId=${encodeURIComponent(itemId)}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao remover item");
  return data;
}

async function convertToOrder(quoteId: string) {
  const res = await fetch(`/api/quotes/${quoteId}/convert-to-order`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao converter para pedido");
  return data as { ok: boolean; orderId: string };
}

async function patchOrder(orderId: string, payload: any) {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao salvar pedido");
  return data;
}

export default function OrcamentoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const qc = useQueryClient();

  const qQuote = useQuery({ queryKey: ["quote", id], queryFn: () => fetchQuote(id) });
  const qProd = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const quote = qQuote.data?.quote ?? null;
  const items: any[] = quote?.items ?? [];

  const [productQ, setProductQ] = React.useState("");
  const [productId, setProductId] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [unitPrice, setUnitPrice] = React.useState("");

  React.useEffect(() => {
    if (!productId) return;
    const p = (qProd.data?.products ?? []).find((x: any) => x.id === productId);
    const sp = Number(p?.salePrice ?? 0);
    if (Number.isFinite(sp) && sp > 0) setUnitPrice(String(sp));
  }, [productId, qProd.data?.products]);

  const products = React.useMemo(() => qProd.data?.products ?? [], [qProd.data?.products]);

  const filtered = React.useMemo(() => {
    const needle = productQ.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p: any) => {
      const name = String(p?.name ?? "").toLowerCase();
      const code = String(p?.code ?? "").toLowerCase();
      return name.includes(needle) || code.includes(needle);
    });
  }, [products, productQ]);

  const addMut = useMutation({
    mutationFn: () => {
      const q = Number(String(qty).replace(",", "."));
      const up = Number(String(unitPrice).replace(",", "."));
      if (!productId) throw new Error("Selecione um produto.");
      if (!Number.isFinite(q) || q <= 0) throw new Error("Quantidade inválida.");
      if (!Number.isFinite(up) || up <= 0) throw new Error("Informe o preço unitário.");
      return addQuoteItem(id, { productId, quantity: q, unitPrice: up });
    },
    onSuccess: async () => {
      toast.success("Item adicionado.");
      setProductId(""); setProductQ(""); setQty("1"); setUnitPrice("");
      await qc.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (itemId: string) => removeQuoteItem(id, itemId),
    onSuccess: async () => {
      toast.success("Item removido.");
      await qc.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const convertMut = useMutation({
    mutationFn: () => convertToOrder(id),
    onSuccess: async (d) => {
      toast.success("Convertido em pedido!");
      await qc.invalidateQueries({ queryKey: ["quotes"] });
      router.push(`/pedidos/${d.orderId}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao converter"),
  });

  const convertAndSendMut = useMutation({
    mutationFn: async () => {
      const d = await convertToOrder(id);
      await patchOrder(d.orderId, { sendToCashier: true });
      return d.orderId;
    },
    onSuccess: async (orderId) => {
      toast.success("Convertido e enviado ao Caixa!");
      router.push(`/pedidos/${orderId}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  if (qQuote.isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (qQuote.isError || !quote) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full border bg-muted" />
        <div className="text-lg font-semibold">Orçamento não encontrado</div>
        <div className="mt-1 text-sm text-muted-foreground">O orçamento pode ter sido removido ou o link é inválido.</div>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/comercial/orcamentos"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
        </Button>
      </div>
    );
  }

  const total = n(quote.total);
  const subtotal = n(quote.subtotal);
  const validUntil = quote.validUntil ? new Date(String(quote.validUntil)) : null;
  const isExpired = validUntil ? validUntil.getTime() < Date.now() : false;
  const daysLeft = validUntil ? Math.ceil((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const status = String(quote.status ?? "").toUpperCase();
  const isDraft = status === "DRAFT";
  const isCanceled = status === "CANCELED" || status === "REJECTED";
  const isPending = convertMut.isPending || convertAndSendMut.isPending;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title={`Orçamento #${quote.number ?? id.slice(0, 8)}`}
        subtitle={quote.client?.name ?? "Cliente não informado"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/api/print/quotes/${id}`, "_blank")}
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" /> PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const num = quote?.number ? String(quote.number) : id.slice(0, 8);
                const cli = quote?.client?.name ?? "Cliente";
                const val = validUntil ? validUntil.toLocaleDateString("pt-BR") : "—";
                const pdfUrl = `${window.location.origin}/api/print/quotes/${id}`;
                const txt = `Olá! Segue o *orçamento ${num}*.\nCliente: ${cli}\nTotal: ${brl(total)}\nValidade: ${val}\n\nPDF: ${pdfUrl}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
              }}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" /> WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const num = quote?.number ? String(quote.number) : id.slice(0, 8);
                const cli = quote?.client?.name ?? "Cliente";
                const pdfUrl = `${window.location.origin}/api/print/quotes/${id}`;
                await navigator.clipboard.writeText(`Orçamento ${num}\nCliente: ${cli}\nTotal: ${brl(total)}\nPDF: ${pdfUrl}`);
                toast.success("Mensagem copiada!");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
        }
      />

      {/* Status + Total banner */}
      <div className="flex items-center justify-between rounded-2xl border bg-background p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(status)}`}>
            {ptQuoteStatus(status)}
          </span>
          {validUntil && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {isExpired ? (
                <span className="text-red-600 font-medium">Vencido</span>
              ) : (
                <span>{daysLeft} dia(s) restante(s) · {validUntil.toLocaleDateString("pt-BR")}</span>
              )}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
          <div className="text-2xl font-bold tracking-tight tabular-nums">{brl(total)}</div>
          {subtotal !== total && (
            <div className="text-xs text-muted-foreground">Subtotal: {brl(subtotal)}</div>
          )}
        </div>
      </div>

      {/* Expired warning */}
      {isExpired && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800">
            Orçamento vencido. Somente o Admin pode desbloquear para conversão.
          </div>
        </div>
      )}

      {/* Convert to order / Send to cashier */}
      {!isCanceled && items.length > 0 && (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/30 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-base">Converter em Pedido</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Transforma este orçamento em um pedido. Você pode editar os dados de pagamento e fiscal no pedido.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isPending || isExpired}
                onClick={() => convertMut.mutate()}
              >
                {convertMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShoppingCart className="mr-2 h-4 w-4" />}
                {convertMut.isPending ? "Convertendo..." : "Converter em Pedido"}
              </Button>
              <Button
                variant="outline"
                disabled={isPending || isExpired}
                onClick={() => convertAndSendMut.mutate()}
              >
                {convertAndSendMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {convertAndSendMut.isPending ? "Enviando..." : "Converter e enviar ao Caixa"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Itens */}
      <SectionCard
        title="Itens"
        defaultOpen
        rightSlot={<span className="text-xs text-muted-foreground">{items.length} item(ns)</span>}
      >
        <div className="space-y-4">
          {/* Add item form */}
          {isDraft && (
            <div className="space-y-3 rounded-lg border bg-background p-3">
              <div className="text-xs font-medium text-muted-foreground">Adicionar item</div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 h-9"
                  placeholder="Buscar produto (nome / código)…"
                  value={productQ}
                  onChange={(e) => setProductQ(e.target.value)}
                />
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_80px_100px_auto]">
                <select
                  className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">{qProd.isLoading ? "Carregando..." : "Produto…"}</option>
                  {filtered.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.code ? `${p.code} - ` : ""}{p.name}
                      {n(p.salePrice) > 0 ? ` · ${brl(n(p.salePrice))}` : ""}
                    </option>
                  ))}
                </select>
                <Input className="h-9" type="number" inputMode="decimal" placeholder="Qtd" value={qty} onChange={(e) => setQty(e.target.value)} />
                <Input className="h-9" type="number" inputMode="decimal" placeholder="Preço unit." value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
                <Button
                  size="sm"
                  className="h-9"
                  disabled={!productId || addMut.isPending}
                  onClick={() => addMut.mutate()}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {addMut.isPending ? "..." : "Adicionar"}
                </Button>
              </div>
            </div>
          )}

          {/* Item list */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="mb-2 h-8 w-8 text-muted-foreground/30" />
              <div className="text-sm font-medium">Sem itens</div>
              <div className="mt-1 text-xs text-muted-foreground">Adicione produtos ao orçamento.</div>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              {items.map((it: any) => (
                <div key={it.id} className="flex items-center justify-between border-b last:border-b-0 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{it.product?.name ?? it.productId}</div>
                    <div className="text-xs text-muted-foreground">
                      {n(it.quantity)} × {brl(n(it.unitPrice))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <div className="text-sm font-medium tabular-nums">{brl(n(it.total))}</div>
                    {isDraft && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => delMut.mutate(it.id)}
                        disabled={delMut.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between bg-muted/30 px-4 py-3">
                <div className="text-sm font-semibold">Total</div>
                <div className="text-2xl font-bold tracking-tight tabular-nums">{brl(total)}</div>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
