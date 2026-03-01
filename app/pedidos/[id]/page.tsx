"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  if (!res.ok) return { products: [] };
  return res.json();
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

async function confirmOrder(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}/confirm`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao confirmar");
  return data;
}

export default function PedidoEditPage() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["order", id], queryFn: () => fetchOrder(id) });
  const order = data?.order;

  const { data: matData } = useQuery({
    queryKey: ["order-materials", id],
    queryFn: () => fetchOrderMaterials(id),
    enabled: !!order,
  });

  const [productId, setProductId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [unitPrice, setUnitPrice] = React.useState(0);
  const [msg, setMsg] = React.useState<string | null>(null);

  const { data: prodData } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const addMut = useMutation({
    mutationFn: (p: any) => addItem(id, p),
    onSuccess: async () => {
      setProductId("");
      setQuantity(1);
      setUnitPrice(0);
      await qc.invalidateQueries({ queryKey: ["order", id] });
      await qc.invalidateQueries({ queryKey: ["order-materials", id] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (itemId: string) => removeItem(itemId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["order", id] });
      await qc.invalidateQueries({ queryKey: ["order-materials", id] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const confMut = useMutation({
    mutationFn: () => confirmOrder(id),
    onSuccess: async () => {
      setMsg("Pedido confirmado! OP e AR gerados.");
      await qc.invalidateQueries({ queryKey: ["order", id] });
      await qc.invalidateQueries({ queryKey: ["order-materials", id] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;
  if (!order) return <div className="p-6">Pedido não encontrado.</div>;

  const total = (order.items ?? []).reduce((s: number, it: any) => s + Number(it.total ?? 0), 0);

  const shortages = matData?.shortages ?? [];
  const canConfirm = String(order.status) === "DRAFT" && shortages.length === 0;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Pedido</h1>

      <Card>
        <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div><b>Cliente:</b> {order.client?.name ?? "—"}</div>
          <div><b>Status:</b> {order.status}</div>
          <div><b>Total:</b> R$ {Number(total).toFixed(2)}</div>

          <div className="pt-2 flex gap-2">
            <Button disabled={!canConfirm || confMut.isPending} onClick={() => confMut.mutate()}>
              {confMut.isPending ? "Confirmando..." : "Confirmar pedido"}
            </Button>
            {!canConfirm && String(order.status) === "DRAFT" && shortages.length > 0 && (
              <span className="text-sm text-red-600 self-center">Falta material no estoque para confirmar.</span>
            )}
          </div>

          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Materiais (BOM * quantidade)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(matData?.rows ?? []).length === 0 && (
            <p className="text-muted-foreground">Sem BOM nos produtos do pedido (ou pedido sem itens).</p>
          )}

          {(matData?.rows ?? []).map((r: any) => (
            <div key={r.materialId} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{r.code ? `${r.code} - ` : ""}{r.name}</div>
                <div className="text-sm text-muted-foreground">
                  Necessário: {Number(r.need ?? 0).toFixed(4)} · Disponível: {Number(r.available ?? 0).toFixed(4)}
                </div>
              </div>
              <div className={r.ok ? "text-sm text-green-600" : "text-sm text-red-600"}>
                {r.ok ? "OK" : "FALTA"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Adicionar item</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select className="border rounded p-2" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Produto…</option>
            {(prodData?.products ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{p.code ? `${p.code} - ` : ""}{p.name}</option>
            ))}
          </select>
          <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          <Input type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
          <Button disabled={!productId || quantity <= 0 || addMut.isPending} onClick={() => addMut.mutate({ productId, quantity, unitPrice })}>
            {addMut.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Itens</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(order.items ?? []).map((it: any) => (
            <div key={it.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{it.product?.name ?? it.productId}</div>
                <div className="text-sm text-muted-foreground">
                  Qtd {it.quantity} · Unit R$ {Number(it.unitPrice ?? 0).toFixed(2)} · Total R$ {Number(it.total ?? 0).toFixed(2)}
                </div>
              </div>
              <Button variant="destructive" onClick={() => delMut.mutate(it.id)} disabled={delMut.isPending}>Remover</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
