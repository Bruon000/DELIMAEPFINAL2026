"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Client = { id: string; name: string; document?: string | null };
type Product = { id: string; name: string; code?: string | null; salePrice?: string | number | null; isActive: boolean };

type CartItem = {
  productId: string;
  name: string;
  code?: string | null;
  quantity: number;
  unitPrice: number;
};

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function fetchClients() {
  const res = await fetch("/api/clients");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar clientes");
  return (data?.clients ?? []) as Client[];
}

async function fetchProducts() {
  const res = await fetch("/api/products");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar produtos");
  const list = (data?.products ?? data?.rows ?? data) as any[];
  return (Array.isArray(list) ? list : []) as Product[];
}

async function fetchWalkinClient() {
  const res = await fetch("/api/clients/walkin");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar cliente balcão");
  return data?.client as { id: string; name: string };
}

async function createOrder(payload: any) {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao criar pedido");
  return data as { id: string };
}

async function addOrderItem(orderId: string, payload: any) {
  const res = await fetch(`/api/orders/${orderId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao adicionar item");
  return data;
}

export default function ComercialVendaPage() {
  const router = useRouter();

  const qClients = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const qProducts = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const qWalkin = useQuery({ queryKey: ["walkin-client"], queryFn: fetchWalkinClient });

  const [walkIn, setWalkIn] = React.useState(false);
  const [clientId, setClientId] = React.useState("");
  const [qClient, setQClient] = React.useState("");

  const [qProd, setQProd] = React.useState("");
  const [cart, setCart] = React.useState<CartItem[]>([]);

  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "PIX" | "CARD" | "TRANSFER" | "OTHER">("PIX");
  const [cardBrand, setCardBrand] = React.useState<"VISA" | "MASTERCARD" | "ELO" | "AMEX" | "HIPERCARD" | "OTHER">("VISA");
  const [installments, setInstallments] = React.useState("1");
  const [requestedDocType, setRequestedDocType] = React.useState<"NFCE" | "NFE">("NFCE");
  const [paymentNote, setPaymentNote] = React.useState("");

  const clients = React.useMemo(() => qClients.data ?? [], [qClients.data]);
  const products = (qProducts.data ?? []).filter((p) => p?.isActive !== false);

  // default fiscal suggestion
  React.useEffect(() => {
    if (walkIn) {
      setRequestedDocType("NFCE");
      return;
    }
    const c = clients.find((x) => x.id === clientId);
    const doc = String(c?.document ?? "").replace(/\D/g, "");
    if (doc.length === 14) setRequestedDocType("NFE");
    else setRequestedDocType("NFCE");
  }, [walkIn, clientId, clients]);

  const filteredClients = React.useMemo(() => {
    const needle = qClient.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) => {
      const name = String(c?.name ?? "").toLowerCase();
      const doc = String(c?.document ?? "").toLowerCase();
      return name.includes(needle) || doc.includes(needle);
    });
  }, [clients, qClient]);

  const filteredProducts = React.useMemo(() => {
    const needle = qProd.trim().toLowerCase();
    if (!needle) return products.slice(0, 30);
    return products
      .filter((p) => {
        const name = String(p?.name ?? "").toLowerCase();
        const code = String(p?.code ?? "").toLowerCase();
        return name.includes(needle) || code.includes(needle);
      })
      .slice(0, 30);
  }, [products, qProd]);

  const subtotal = cart.reduce((s, it) => s + it.quantity * it.unitPrice, 0);

  const addToCart = (p: Product) => {
    const id = String(p.id);
    const price = n(p.salePrice);
    setCart((prev) => {
      const ix = prev.findIndex((x) => x.productId === id);
      if (ix >= 0) {
        const next = [...prev];
        next[ix] = { ...next[ix], quantity: next[ix].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        { productId: id, name: p.name, code: p.code ?? null, quantity: 1, unitPrice: price > 0 ? price : 0 },
      ];
    });
    toast.success("Adicionado: " + p.name);
  };

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!walkIn && !clientId) throw new Error("Selecione um cliente ou marque Balcão.");
      if (cart.length === 0) throw new Error("Adicione pelo menos 1 produto.");

      const cid = walkIn ? String(qWalkin.data?.id ?? "") : clientId;
      if (!cid) throw new Error("Cliente balcão não encontrado. Rode o seed.");

      const order = await createOrder({
        clientId: cid,
        walkIn,
        sentToCashier: true,
        requestedDocType,
        paymentMethod,
        cardBrand: paymentMethod === "CARD" ? cardBrand : null,
        installments: paymentMethod === "CARD" ? Number(installments) : null,
        paymentNote: paymentNote.trim() || null,
        notes: walkIn ? "Venda balcão (sem cadastro)" : null,
      });

      for (const it of cart) {
        await addOrderItem(order.id, {
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        });
      }

      return order.id;
    },
    onSuccess: (id) => {
      toast.success("Enviado para o caixa.");
      router.push(`/pedidos/${id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar para o caixa"),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Venda (Vendedor)"
        subtitle="Monte a venda e envie para o Caixa receber e emitir."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/clientes">Clientes</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pedidos">Pedidos</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[420px_1fr_360px]">
        {/* Cliente */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={walkIn} onChange={(e) => setWalkIn(e.target.checked)} />
              Venda de balcão (sem cadastro) → NFC-e
            </label>

            {!walkIn ? (
              <>
                <Input placeholder="Buscar cliente (nome/doc)" value={qClient} onChange={(e) => setQClient(e.target.value)} />
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={qClients.isLoading}
                >
                  <option value="">
                    {qClients.isLoading ? "Carregando..." : "Selecione um cliente…"}
                  </option>
                  {filteredClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-muted-foreground">
                  Sugestão automática: CNPJ → NFE, caso contrário → NFC-e (você pode mudar).
                </div>
              </>
            ) : (
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">{qWalkin.data?.name ?? "CONSUMIDOR FINAL (BALCÃO)"}</div>
                <div className="text-xs text-muted-foreground">Sem CPF/CNPJ · venda rápida</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Itens */}
        <Card>
          <CardHeader>
            <CardTitle>Itens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Buscar produto (nome/código)..." value={qProd} onChange={(e) => setQProd(e.target.value)} />
            <div className="max-h-[240px] overflow-auto rounded-md border">
              {qProducts.isLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Carregando produtos...</div>
              ) : (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.code ? `Código: ${p.code} · ` : ""}{brl(n(p.salePrice))}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Adicionar</div>
                  </button>
                ))
              )}
            </div>

            <div className="rounded-md border">
              <div className="grid grid-cols-[1fr_110px_110px_40px] gap-2 border-b bg-muted px-3 py-2 text-xs font-medium">
                <div>Produto</div>
                <div className="text-right">Qtd</div>
                <div className="text-right">Unit</div>
                <div />
              </div>
              {cart.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Adicione produtos acima.</div>
              ) : (
                cart.map((it) => (
                  <div key={it.productId} className="grid grid-cols-[1fr_110px_110px_40px] gap-2 px-3 py-2 text-sm items-center border-b">
                    <div>
                      <div className="font-medium">{it.name}</div>
                      <div className="text-xs text-muted-foreground">{it.code ?? ""}</div>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCart((p) => p.map((x) => x.productId === it.productId ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}
                      >
                        -
                      </Button>
                      <Input
                        className="w-14 text-right"
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) => setCart((p) => p.map((x) => x.productId === it.productId ? { ...x, quantity: Math.max(1, n(e.target.value)) } : x))}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCart((p) => p.map((x) => x.productId === it.productId ? { ...x, quantity: x.quantity + 1 } : x))}
                      >
                        +
                      </Button>
                    </div>
                    <div className="text-right">
                      <Input
                        className="text-right"
                        type="number"
                        step="0.01"
                        value={it.unitPrice}
                        onChange={(e) => setCart((p) => p.map((x) => x.productId === it.productId ? { ...x, unitPrice: n(e.target.value) } : x))}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCart((p) => p.filter((x) => x.productId !== it.productId))}
                      title="Remover"
                    >
                      ✕
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pré-checkout */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Pré-checkout (vai pro Caixa)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Subtotal</div>
              <div className="text-lg font-semibold">{brl(subtotal)}</div>
            </div>

            <div className="space-y-1">
              <Label>Forma de pagamento</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)}>
                <option value="PIX">Pix</option>
                <option value="CASH">Dinheiro</option>
                <option value="CARD">Cartão</option>
                <option value="TRANSFER">Transferência</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>

            {paymentMethod === "CARD" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Bandeira</Label>
                  <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={cardBrand} onChange={(e) => setCardBrand(e.target.value as any)}>
                    <option value="VISA">Visa</option>
                    <option value="MASTERCARD">Mastercard</option>
                    <option value="ELO">Elo</option>
                    <option value="AMEX">Amex</option>
                    <option value="HIPERCARD">Hipercard</option>
                    <option value="OTHER">Outra</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Parcelas</Label>
                  <Input type="number" min="1" value={installments} onChange={(e) => setInstallments(e.target.value)} />
                </div>
              </div>
            ) : null}

            <div className="space-y-1">
              <Label>Tipo fiscal desejado</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={requestedDocType} onChange={(e) => setRequestedDocType(e.target.value as any)}>
                <option value="NFCE">NFC-e (balcão)</option>
                <option value="NFE">NF-e</option>
              </select>
              <div className="text-xs text-muted-foreground">
                O Caixa pode ajustar na hora. Se for NFE, a confirmação pode exigir emissão antes (bloqueio).
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observação</Label>
              <Input value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} placeholder="Ex.: Visa crédito, Pix pendente, etc." />
            </div>

            <Button onClick={() => sendMut.mutate()} disabled={sendMut.isPending}>
              {sendMut.isPending ? "Enviando..." : "Enviar para o Caixa"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
