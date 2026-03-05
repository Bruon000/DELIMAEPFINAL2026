"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export default function OrcamentoDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();

  const qQuote = useQuery({ queryKey: ["quote", id], queryFn: () => fetchQuote(id) });
  const qProd = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const quote = qQuote.data?.quote ?? qQuote.data?.row ?? qQuote.data?.data ?? qQuote.data?.item ?? qQuote.data?.quote;
  const items = quote?.items ?? [];

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

  const products = React.useMemo(() => {
    return qProd.data?.products ?? [];
  }, [qProd.data?.products]);

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
      // unitPrice pode ficar vazio; API pode permitir 0, mas aqui exigimos algum valor pro orçamento ficar certo
      if (!Number.isFinite(up) || up <= 0) throw new Error("Informe o preço unitário.");
      return addQuoteItem(id, { productId, quantity: q, unitPrice: up });
    },
    onSuccess: async () => {
      toast.success("Item adicionado no orçamento.");
      setProductId("");
      setProductQ("");
      setQty("1");
      setUnitPrice("");
      await qc.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar item"),
  });

  const delMut = useMutation({
    mutationFn: (itemId: string) => removeQuoteItem(id, itemId),
    onSuccess: async () => {
      toast.success("Item removido.");
      await qc.invalidateQueries({ queryKey: ["quote", id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover item"),
  });

  const convertMut = useMutation({
    mutationFn: () => convertToOrder(id),
    onSuccess: async (d) => {
      toast.success("Convertido para pedido!");
      await qc.invalidateQueries({ queryKey: ["quotes"] });
      window.location.href = `/pedidos/${(d as any).orderId}`;
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao converter"),
  });

  if (qQuote.isLoading) return <div className="p-6">Carregando...</div>;
  if (qQuote.isError) return <div className="p-6 text-red-600">Erro: {(qQuote.error as any)?.message ?? "Falha"}</div>;
  if (!quote) return <div className="p-6">Orçamento não encontrado.</div>;

  const subtotal = Number(quote.subtotal ?? 0);
  const total = Number(quote.total ?? 0);
  const validUntil = quote.validUntil ? new Date(String(quote.validUntil)) : null;
  const isExpired = validUntil ? validUntil.getTime() < Date.now() : false;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Orçamento</h1>

      <Card>
        <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div><b>Cliente:</b> {quote.client?.name ?? "—"}</div>
          <div><b>Status:</b> {ptQuoteStatus(quote.status)}</div>
          <div><b>Validade:</b> {validUntil ? validUntil.toLocaleDateString("pt-BR") : "—"} {isExpired ? "(vencido)" : ""}</div>
          <div><b>Total:</b> R$ {total.toFixed(2)} <span className="text-xs text-muted-foreground">(subtotal R$ {subtotal.toFixed(2)})</span></div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(`/api/print/quotes/${id}`, "_blank")}
            >
              Abrir PDF
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const num = quote?.number ? String(quote.number) : String(id);
                const cli = quote?.client?.name ? String(quote.client.name) : "Cliente";
                const validade = validUntil ? validUntil.toLocaleDateString("pt-BR") : "—";
                const txt =
                  `Olá! Segue o orçamento ${num}.\n` +
                  `Cliente: ${cli}\n` +
                  `Total: R$ ${total.toFixed(2)}\n` +
                  `Validade: ${validade}\n\n` +
                  `Posso te enviar o PDF do orçamento também.`;
                const url = `https://wa.me/?text=${encodeURIComponent(txt)}`;
                window.open(url, "_blank");
              }}
            >
              WhatsApp
            </Button>
          </div>

          <div className="pt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const num = quote?.number ? String(quote.number) : String(id);
                const cli = quote?.client?.name ? String(quote.client.name) : "Cliente";
                const pdfUrl = `${window.location.origin}/api/print/quotes/${id}`;
                const txt =
                  `Olá! Segue o *orçamento ${num}*.\n` +
                  `Cliente: ${cli}\n` +
                  `Total: R$ ${Number(total).toFixed(2)}\n` +
                  `Validade: ${validUntil ? validUntil.toLocaleDateString("pt-BR") : "—"}\n\n` +
                  `PDF: ${pdfUrl}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
              }}
            >
              WhatsApp
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const num = quote?.number ? String(quote.number) : String(id);
                const cli = quote?.client?.name ? String(quote.client.name) : "Cliente";
                const pdfUrl = `${window.location.origin}/api/print/quotes/${id}`;
                const txt =
                  `Orçamento ${num}\nCliente: ${cli}\nTotal: R$ ${Number(total).toFixed(2)}\nPDF: ${pdfUrl}`;
                await navigator.clipboard.writeText(txt);
                toast.success("Mensagem copiada!");
              }}
            >
              Copiar mensagem
            </Button>
            <Button
              disabled={convertMut.isPending || String(quote.status ?? "").toUpperCase() === "CANCELED"}
              onClick={() => convertMut.mutate()}
            >
              {convertMut.isPending ? "Convertendo..." : "Converter para pedido"}
            </Button>
          </div>

          {isExpired ? (
            <div className="text-sm text-red-600">
              Orçamento vencido. Se estiver travado, somente o Admin pode desbloquear.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Adicionar item</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Buscar produto (nome / código)…"
            value={productQ}
            onChange={(e) => setProductQ(e.target.value)}
          />

          <div className="grid gap-3 md:grid-cols-4">
            <select className="border rounded p-2" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">{qProd.isLoading ? "Carregando..." : "Produto…"}</option>
              {filtered.length === 0 && !qProd.isLoading ? <option value="" disabled>Nenhum produto encontrado</option> : null}
              {filtered.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} - ` : ""}{p.name}
                  {Number(p.salePrice ?? 0) > 0 ? ` · R$ ${Number(p.salePrice).toFixed(2)}` : ""}
                </option>
              ))}
            </select>

            <Input type="number" inputMode="decimal" placeholder="Qtd" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input type="number" inputMode="decimal" placeholder="Preço unit." value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />

            <Button disabled={!productId || addMut.isPending} onClick={() => addMut.mutate()}>
              {addMut.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Premium: preço puxa do cadastro, mas você pode editar aqui (construtora/atacado).
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Itens</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? <p className="text-muted-foreground">Sem itens ainda.</p> : null}
          {items.map((it: any) => (
            <div key={it.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{it.product?.name ?? it.productId}</div>
                <div className="text-sm text-muted-foreground">
                  Qtd {Number(it.quantity ?? 0)} · Unit R$ {Number(it.unitPrice ?? 0).toFixed(2)} · Total R$ {Number(it.total ?? 0).toFixed(2)}
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => delMut.mutate(it.id)} disabled={delMut.isPending}>
                Remover
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
