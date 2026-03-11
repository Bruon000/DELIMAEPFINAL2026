"use client";

import * as React from "react";
import { toast } from "sonner";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatQuantity } from "@/lib/format-quantity";

function ptStatus(s: any) {
  const x = String(s ?? "").toUpperCase();
  const map: Record<string, string> = {
    DRAFT: "Rascunho",
    OPEN: "Aberto",
    CONFIRMED: "Confirmado",
    IN_PRODUCTION: "Em produção",
    READY: "Pronto",
    DELIVERED: "Entregue",
    CANCELED: "Cancelado",
  };
  return map[x] ?? (x || "—");
}

async function fetchOrder(id: string) {
  const res = await fetch(`/api/orders/${id}`);
  if (!res.ok) throw new Error("Erro ao carregar pedido");
  return res.json();
}

async function fetchOrderMaterials(id: string) {
  const res = await fetch(`/api/orders/${id}/materials`);
  if (!res.ok) return { rows: [], shortages: [] };
  return res.json();
}

async function fetchProducts() {
  const res = await fetch(`/api/products`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = res.status === 401 ? "Sessão expirada. Faça login novamente." : (data?.message ?? data?.error ?? "Erro ao carregar produtos");
    throw new Error(msg);
  }
  return data;
}

async function addItem(orderId: string, payload: any) {
  const res = await fetch(`/api/orders/${orderId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Erro ao adicionar item");
  }
  return res.json();
}

async function removeItem(itemId: string) {
  const res = await fetch(`/api/order-items/${itemId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erro ao remover item");
  return res.json();
}

async function updateItemQuantity(itemId: string, quantity: number) {
  const res = await fetch(`/api/order-items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao atualizar quantidade");
  return data;
}

async function patchOrder(orderId: string, payload: any) {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao salvar");
  return data;
}

async function setOrderDiscount(orderId: string, discountPercent: number) {
  const res = await fetch(`/api/orders/${orderId}/set-discount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ discountPercent }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao aplicar desconto");
  return data;
}

async function requestOrderDiscount(orderId: string, requestedPercent: number, reason: string) {
  const res = await fetch(`/api/orders/${orderId}/discount-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestedPercent, reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao solicitar desconto");
  return data;
}

export default function PedidoEditPage() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["order", id], queryFn: () => fetchOrder(id) });
  const order = data?.order;
  const discountApproval = data?.discountApproval ?? null;

  React.useEffect(() => {
    if (!order) return;
    const rd = String(order?.requestedDocType ?? "").toUpperCase();
    const pm = String(order?.paymentMethod ?? "").toUpperCase();
    const cb = String(order?.cardBrand ?? "").toUpperCase();
    if (rd === "NFE" || rd === "NFCE") setRequestedDocType(rd as any);
    if (["CASH", "PIX", "CARD", "OTHER", "TRANSFER"].includes(pm)) setPaymentMethod(pm as any);
    if (cb) setCardBrand(cb as any);
    if (order?.installments != null) setInstallments(String(order.installments));
    if (order?.dueDays != null) setDueDays(String(order.dueDays));
    if (order?.paymentNote != null) setPaymentNote(String(order.paymentNote ?? ""));
    const dp = Number((order as any)?.discountPercent ?? 0);
    if (dp > 0) setDiscountPct(String(dp));
  }, [order]);

  const { data: matData } = useQuery({
    queryKey: ["order-materials", id],
    queryFn: () => fetchOrderMaterials(id),
    enabled: !!order,
  });

  const [productId, setProductId] = React.useState("");
  const [productQ, setProductQ] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [unitPrice, setUnitPrice] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [discountPct, setDiscountPct] = React.useState("");
  const [discountReason, setDiscountReason] = React.useState("");
  const [discountOpen, setDiscountOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const [editingQty, setEditingQty] = React.useState<Record<string, string>>({});
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const quantityInputRef = React.useRef<HTMLInputElement>(null);

  // ===== intenção do vendedor para o PDV =====
  const [requestedDocType, setRequestedDocType] = React.useState<"NFCE" | "NFE">("NFCE");
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "PIX" | "CARD" | "OTHER" | "TRANSFER">("PIX");
  const [cardBrand, setCardBrand] = React.useState<"VISA" | "MASTERCARD" | "ELO" | "AMEX" | "HIPERCARD">("VISA");
  const [installments, setInstallments] = React.useState("1");
  const [dueDays, setDueDays] = React.useState("15");
  const [paymentNote, setPaymentNote] = React.useState("");

  const prodQ = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const prodData = prodQ.data;

  React.useEffect(() => {
    if (prodQ.isError) setMsg((prodQ.error as any)?.message ?? "Erro ao carregar produtos");
  }, [prodQ.isError, prodQ.error]);

  // Ao selecionar um produto, usa o preço de venda cadastrado (editável na hora)
  React.useEffect(() => {
    if (!productId) return;
    const p = (prodData?.products ?? []).find((x: any) => x.id === productId);
    if (!p) return;
    const sp = Number(p.salePrice ?? 0);
    if (Number.isFinite(sp) && sp > 0) setUnitPrice(String(sp));
  }, [productId, prodData?.products]);

  const products = React.useMemo(() => {
    return prodData?.products ?? [];
  }, [prodData?.products]);

  const filteredProducts = React.useMemo(() => {
    const needle = productQ.trim().toLowerCase();
    if (!needle) return products;
    return products.filter((p: any) => {
      const name = String(p?.name ?? "").toLowerCase();
      const code = String(p?.code ?? "").toLowerCase();
      return name.includes(needle) || code.includes(needle);
    });
  }, [products, productQ]);

  const suggestions = React.useMemo(() => filteredProducts.slice(0, 15), [filteredProducts]);

  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [productQ]);

  React.useEffect(() => {
    setHighlightedIndex((i) => Math.min(i, Math.max(0, suggestions.length - 1)));
  }, [suggestions.length]);

  const addMut = useMutation({
    mutationFn: (p: any) => addItem(id, p),
    onSuccess: async () => {
      setProductId("");
      setProductQ("");
      setQuantity("1");
      setUnitPrice("");
      searchInputRef.current?.focus();
      await qc.invalidateQueries({ queryKey: ["order", id] });
      await qc.invalidateQueries({ queryKey: ["order-materials", id] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const doAddItem = React.useCallback(
    (targetProductId?: string) => {
      let p: any;
      if (targetProductId) {
        p = (prodData?.products ?? []).find((x: any) => x.id === targetProductId);
      } else if (productId) {
        p = (prodData?.products ?? []).find((x: any) => x.id === productId);
      } else if (productQ.trim()) {
        const needle = productQ.trim().toLowerCase();
        const exact = (prodData?.products ?? []).find(
          (x: any) => String(x?.code ?? "").toLowerCase() === needle
        );
        p = exact ?? filteredProducts[0];
      }
      if (!p) {
        toast.error("Selecione ou digite um produto.");
        return;
      }
      const qty = Number(String(quantity ?? "").replace(",", "."));
      const up = Number(String(unitPrice ?? "").replace(",", "."));
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error("Informe quantidade válida.");
        return;
      }
      addMut.mutate({
        productId: p.id,
        quantity: qty,
        unitPrice: Number.isFinite(up) && up >= 0 ? up : Number(p.salePrice ?? 0),
      });
    },
    [productId, productQ, quantity, unitPrice, prodData?.products, filteredProducts, addMut]
  );

  const delMut = useMutation({
    mutationFn: (itemId: string) => removeItem(itemId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["order", id] });
      await qc.invalidateQueries({ queryKey: ["order-materials", id] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const updateQtyMut = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) => updateItemQuantity(itemId, quantity),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["order", id] });
      await qc.invalidateQueries({ queryKey: ["order-materials", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const sendToCashierMut = useMutation({
    mutationFn: (payload: any) => patchOrder(id, { ...payload, sendToCashier: true }),
    onSuccess: async () => {
      toast.success("Enviado ao caixa (DRAFT).");
      await qc.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar"),
  });

  const discMut = useMutation({
    mutationFn: async () => {
      const pct = Number(discountPct ?? 0);
      if (!Number.isFinite(pct) || pct < 0) throw new Error("Percentual inválido.");
      if (pct <= 5) return setOrderDiscount(id, pct);
      return requestOrderDiscount(id, pct, discountReason.trim());
    },
    onSuccess: async () => {
      const pct = Number(discountPct ?? 0);
      toast.success(pct <= 5 ? "Desconto aplicado." : "Solicitação enviada. Aguarde aprovação do admin.");
      setDiscountOpen(false);
      setDiscountPct("");
      setDiscountReason("");
      await qc.invalidateQueries({ queryKey: ["order", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;
  if (!order) return <div className="p-6">Pedido não encontrado.</div>;

  const subtotal = Number((order as any)?.subtotal ?? 0) || (order.items ?? []).reduce((s: number, it: any) => s + Number(it.total ?? 0), 0);
  const discount = Number((order as any)?.discount ?? 0);
  const total = Number((order as any)?.total ?? 0) || Math.max(0, subtotal - discount);
  const discountPercent = Number((order as any)?.discountPercent ?? 0);

  const approvedPercent = Number((discountApproval as any)?.approvedPercent ?? 0);
  const hasDiscountApproval = (discountApproval as any)?.status === "APPROVED" && approvedPercent >= discountPercent;
  const canSendToCashier = discountPercent <= 5 || hasDiscountApproval;
  const needsApprovalToSend = discountPercent > 5 && !hasDiscountApproval;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Pedido</h1>

      <Card>
        <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div><b>Cliente:</b> {order.client?.name ?? "—"}</div>
          <div><b>Status:</b> {ptStatus(order.status)}</div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(`/api/print/orders/${id}`, "_blank")}
            >
              Abrir PDF
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const num = order?.number ? String(order.number) : String(id);
                const cli = order?.client?.name ? String(order.client.name) : "Cliente";
                const pdfUrl = `${window.location.origin}/api/print/orders/${id}`;
                const txt =
                  `Olá! Segue o *pedido ${num}*.\n` +
                  `Cliente: ${cli}\n` +
                  `Total: R$ ${Number(total).toFixed(2)}\n\n` +
                  `PDF: ${pdfUrl}`;
                const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
                window.open(url, "_blank");
              }}
            >
              WhatsApp
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const num = order?.number ? String(order.number) : String(id);
                const cli = order?.client?.name ? String(order.client.name) : "Cliente";
                const pdfUrl = `${window.location.origin}/api/print/orders/${id}`;
                const txt =
                  `Pedido ${num}\nCliente: ${cli}\nTotal: R$ ${Number(total).toFixed(2)}\nPDF: ${pdfUrl}`;
                await navigator.clipboard.writeText(txt);
                toast.success("Mensagem copiada!");
              }}
            >
              Copiar mensagem
            </Button>
          </div>

          <div className="pt-2">
            <Card>
              <CardHeader>
                <CardTitle>Enviar ao Caixa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  {!(paymentMethod === "OTHER" || paymentMethod === "TRANSFER") ? (
                    <div className="space-y-1">
                      <Label>Documento fiscal desejado</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={requestedDocType}
                        onChange={(e) => setRequestedDocType(e.target.value as any)}
                        disabled={String(order.status) !== "DRAFT"}
                      >
                        <option value="NFCE">NFCE (Balcão)</option>
                        <option value="NFE">NFE (Cliente CNPJ ou solicitação)</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label>Documento fiscal</Label>
                      <p className="text-sm text-muted-foreground">Será emitido ao receber o pagamento.</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label>Forma de pagamento</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      disabled={String(order.status) !== "DRAFT"}
                    >
                      <option value="PIX">PIX</option>
                      <option value="CASH">Dinheiro</option>
                      <option value="CARD">Cartão</option>
                      <option value="OTHER">À prazo</option>
                      <option value="TRANSFER">Transferência</option>
                    </select>
                  </div>
                </div>

                {paymentMethod === "CARD" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Bandeira</Label>
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={cardBrand}
                        onChange={(e) => setCardBrand(e.target.value as any)}
                        disabled={String(order.status) !== "DRAFT"}
                      >
                        <option value="VISA">VISA</option>
                        <option value="MASTERCARD">MASTERCARD</option>
                        <option value="ELO">ELO</option>
                        <option value="AMEX">AMEX</option>
                        <option value="HIPERCARD">HIPERCARD</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <Label>Parcelas</Label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={installments}
                        onChange={(e) => setInstallments(e.target.value)}
                        disabled={String(order.status) !== "DRAFT"}
                      />
                    </div>
                  </div>
                ) : null}

                {(paymentMethod === "OTHER" || paymentMethod === "TRANSFER") && (
                  <div className="space-y-2">
                    <Label>Vencimento</Label>
                    <div className="flex gap-2">
                      {[5, 10, 15].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDueDays(String(d))}
                          disabled={String(order.status) !== "DRAFT"}
                          className={`rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                            dueDays === String(d) ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted"
                          }`}
                        >
                          {d} dias
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Observação</Label>
                  <Input
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    placeholder="Ex.: cliente vai pagar no PIX do balcão / levar troco / etc."
                    disabled={String(order.status) !== "DRAFT"}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={sendToCashierMut.isPending || String(order.status) !== "DRAFT" || (order.items ?? []).length === 0 || !canSendToCashier}
                    onClick={() => {
                      const docType = (paymentMethod === "OTHER" || paymentMethod === "TRANSFER") ? "NFCE" : requestedDocType;
                      sendToCashierMut.mutate({
                        requestedDocType: docType,
                        paymentMethod,
                        cardBrand: paymentMethod === "CARD" ? cardBrand : null,
                        installments: paymentMethod === "CARD" ? Number(installments || "1") : null,
                        dueDays: (paymentMethod === "OTHER" || paymentMethod === "TRANSFER") ? Number(dueDays) || 15 : null,
                        paymentNote,
                      });
                    }}
                    title={
                      (order.items ?? []).length === 0
                        ? "Adicione itens antes de enviar ao caixa."
                        : needsApprovalToSend
                          ? "Desconto acima de 5% precisa ser aprovado pelo admin (Admin → Descontos)."
                          : "Envia como rascunho (DRAFT) para o PDV."
                    }
                  >
                    {sendToCashierMut.isPending ? "Enviando..." : "Enviar ao Caixa"}
                  </Button>
                </div>

                {needsApprovalToSend && (
                  <p className="text-sm text-amber-600">
                    Desconto de {discountPercent}% precisa ser aprovado pelo admin antes de enviar ao caixa. Acesse Admin → Descontos.
                  </p>
                )}

                <div className="text-xs text-muted-foreground">
                  O pedido vai para a fila do PDV como <b>DRAFT</b>. O caixa recebe, emite fiscal e só então confirma (gera OP e reserva estoque).
                </div>
              </CardContent>
            </Card>
          </div>

          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader><CardTitle className="text-lg">Venda</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-2">Adicionar item</h3>
            <div className="space-y-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none z-[1]" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar produto (nome ou código)... Enter para adicionar"
                  value={productQ}
                  onChange={(e) => setProductQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedIndex((i) => Math.max(0, i - 1));
                      return;
                    }
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const chosen = suggestions[highlightedIndex];
                      if (chosen) {
                        setProductId(chosen.id);
                        const price = Number(chosen.salePrice ?? 0);
                        if (Number.isFinite(price) && price > 0) setUnitPrice(String(price));
                        setHighlightedIndex(suggestions.indexOf(chosen));
                        setTimeout(() => quantityInputRef.current?.focus(), 0);
                      } else {
                        doAddItem();
                      }
                      return;
                    }
                  }}
                  className="pl-9 h-10 relative z-[2] bg-background"
                />
              </div>
              {productQ.trim() && suggestions.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto rounded-lg border border-input bg-muted/30">
                  {suggestions.map((p: any, idx: number) => {
                    const price = Number(p.salePrice ?? 0);
                    const sel = p.id === productId || idx === highlightedIndex;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setProductId(p.id);
                          if (Number.isFinite(price) && price > 0) setUnitPrice(String(price));
                          setHighlightedIndex(idx);
                        }}
                        className={`w-full rounded-none border-b last:border-b-0 px-3 py-2.5 text-left text-sm transition first:rounded-t-lg last:rounded-b-lg ${sel ? "bg-primary/15 ring-1 ring-primary/30" : "bg-background hover:bg-muted/50"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{p.code ? `${p.code} - ` : ""}{p.name}</span>
                          <span className="tabular-nums shrink-0 text-muted-foreground">
                            {price > 0 ? `R$ ${price.toFixed(2)}` : "—"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {productQ.trim() && suggestions.length > 0 && (
              <p className="text-xs text-muted-foreground">Defina a quantidade na caixa abaixo e pressione Enter para adicionar.</p>
            )}
            {productQ.trim() && filteredProducts.length === 0 && !prodQ.isLoading && (
              <p className="text-sm text-muted-foreground mb-2">Nenhum produto encontrado.</p>
            )}
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs">Qtd (Enter adiciona)</Label>
                <Input
                  ref={quantityInputRef}
                  type="number"
                  inputMode="decimal"
                  placeholder="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      doAddItem();
                    }
                  }}
                  className="h-10 w-24"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Preço unit.</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="h-10 w-28"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!productId}
                    className="h-10 shrink-0"
                    onClick={() => {
                      const p = (products ?? []).find((x: any) => x.id === productId);
                      const sp = Number(p?.salePrice ?? 0);
                      if (!Number.isFinite(sp) || sp <= 0) return toast.error("Produto sem preço cadastrado.");
                      setUnitPrice(String(sp));
                    }}
                  >
                    Preço
                  </Button>
                </div>
              </div>
              <Button
                disabled={addMut.isPending}
                onClick={() => doAddItem()}
                className="h-10"
              >
                {addMut.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Itens</h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2 font-medium w-12">Seq</th>
                    <th className="text-left p-2 font-medium">Código</th>
                    <th className="text-left p-2 font-medium">Descrição</th>
                    <th className="text-right p-2 font-medium w-20">Qtd</th>
                    <th className="text-right p-2 font-medium w-24">Preço unit.</th>
                    <th className="text-right p-2 font-medium w-24">Total</th>
                    <th className="w-24 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {(order.items ?? []).map((it: any, idx: number) => {
                    const qty = Number(it.quantity ?? 0);
                    const canDecrease = qty > 1;
                    const qtyStr = editingQty[it.id] ?? String(qty);
                    const applyQty = () => {
                      const v = Number(String(qtyStr).replace(",", "."));
                      if (Number.isFinite(v) && v >= 0.0001) {
                        updateQtyMut.mutate({ itemId: it.id, quantity: v });
                      }
                      setEditingQty((prev) => {
                        const next = { ...prev };
                        delete next[it.id];
                        return next;
                      });
                    };
                    return (
                      <tr key={it.id} className="border-t">
                        <td className="p-2 text-muted-foreground">{idx + 1}</td>
                        <td className="p-2">{it.product?.code ?? "—"}</td>
                        <td className="p-2">{it.product?.name ?? it.productId}</td>
                        <td className="p-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              disabled={!canDecrease || updateQtyMut.isPending}
                              onClick={() => updateQtyMut.mutate({ itemId: it.id, quantity: Math.max(1, qty - 1) })}
                              title="Diminuir"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0.0001}
                              step={0.25}
                              className="h-8 w-14 text-center tabular-nums"
                              value={qtyStr}
                              onChange={(e) => setEditingQty((prev) => ({ ...prev, [it.id]: e.target.value }))}
                              onBlur={applyQty}
                              onKeyDown={(e) => e.key === "Enter" && applyQty()}
                              disabled={updateQtyMut.isPending}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              disabled={updateQtyMut.isPending}
                              onClick={() => updateQtyMut.mutate({ itemId: it.id, quantity: qty + 1 })}
                              title="Aumentar"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-2 text-right tabular-nums">R$ {Number(it.unitPrice ?? 0).toFixed(2)}</td>
                        <td className="p-2 text-right tabular-nums">R$ {Number(it.total ?? 0).toFixed(2)}</td>
                        <td className="p-2">
                          <Button variant="ghost" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => delMut.mutate(it.id)} disabled={delMut.isPending}>Remover</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(order.items ?? []).length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-sm">Nenhum item no pedido.</div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-4">
              <span><b>Subtotal:</b> R$ {Number(subtotal).toFixed(2)}</span>
              <div className="flex items-center gap-2">
                {discount > 0 && (
                  <span className="text-muted-foreground">
                    Desconto {discountPercent > 0 ? `${discountPercent}%` : ""}: -R$ {Number(discount).toFixed(2)}
                  </span>
                )}
                {String(order.status) === "DRAFT" && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setDiscountOpen(true)}>
                    {discountPercent > 0 ? `Alterar desconto (${discountPercent}%)` : "Aplicar desconto %"}
                  </Button>
                )}
              </div>
              <span className="font-semibold">Total: R$ {Number(total).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Materiais (BOM × quantidade)</CardTitle>
          <p className="text-xs text-muted-foreground font-normal mt-1">
            Estoque disponível para o pedido: o vendedor vê a quantidade em estoque para ficar ciente do que tem.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {(matData?.rows ?? []).length === 0 && (
            <p className="text-muted-foreground">Sem BOM nos produtos do pedido (ou pedido sem itens).</p>
          )}

          {(matData?.rows ?? []).map((r: any) => {
            const unit = r.unitCode ?? "un";
            return (
              <div key={r.materialId} className="flex items-center justify-between border rounded p-3">
                <div>
                  <div className="font-medium">{r.code ? `${r.code} - ` : ""}{r.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Necessário: <span className="tabular-nums">{formatQuantity(Number(r.need ?? 0), unit)}</span> {unit}
                    {" · "}
                    <span className="font-medium text-foreground">Em estoque: <span className="tabular-nums">{formatQuantity(Number(r.available ?? 0), unit)}</span> {unit}</span>
                    {r.estimatedCost != null && r.estimatedCost > 0 && (
                      <> · Valor est.: R$ {Number(r.estimatedCost).toFixed(2)}</>
                    )}
                  </div>
                </div>
                <div className={r.ok ? "text-sm text-green-600 font-medium" : "text-sm text-red-600 font-medium"}>
                  {r.ok ? "OK" : "FALTA"}
                </div>
              </div>
            );
          })}
          {(matData?.rows ?? []).length > 0 && matData?.totalEstimatedCost != null && Number(matData.totalEstimatedCost) > 0 && (
            <div className="pt-2 border-t text-sm font-medium">
              Total materiais: R$ {Number(matData.totalEstimatedCost).toFixed(2)}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconto na venda</DialogTitle>
            <DialogDescription>
              Até 5%: aplicado direto. Acima de 5%: envia solicitação para o admin aprovar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Percentual (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                placeholder="5"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
              />
            </div>
            {Number(discountPct ?? 0) > 5 && (
              <div className="grid gap-2">
                <Label>Motivo (para aprovação do admin)</Label>
                <Input
                  placeholder="Ex.: cliente fidelidade, pedido grande..."
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)}>Cancelar</Button>
            <Button onClick={() => discMut.mutate()} disabled={discMut.isPending || !discountPct || Number(discountPct) < 0}>
              {discMut.isPending ? "Enviando..." : Number(discountPct ?? 0) <= 5 ? "Aplicar" : "Solicitar aprovação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
