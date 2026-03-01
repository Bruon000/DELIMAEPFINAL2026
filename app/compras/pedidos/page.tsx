"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function fetchSuppliers() {
  const res = await fetch("/api/suppliers");
  if (!res.ok) throw new Error("Erro ao carregar fornecedores");
  return res.json();
}

async function fetchPOs() {
  const res = await fetch("/api/purchase-orders");
  if (!res.ok) throw new Error("Erro ao carregar compras");
  return res.json();
}

async function createPO(payload: any) {
  const res = await fetch("/api/purchase-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
  return data;
}

export default function ComprasPedidosPage() {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);

  const { data: supData } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data, isLoading } = useQuery({ queryKey: ["purchase-orders"], queryFn: fetchPOs });

  const mut = useMutation({
    mutationFn: createPO,
    onSuccess: async (d: any) => {
      setMsg("Pedido de compra criado!");
      setSupplierId("");
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      if (d?.id) window.location.href = `/compras/pedidos/${d.id}`;
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const suppliers = supData?.suppliers ?? [];
  const pos = data?.purchaseOrders ?? [];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Compras</h1>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Novo pedido de compra</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select className="border rounded p-2 w-full" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Fornecedor…</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button disabled={!supplierId || mut.isPending} onClick={() => mut.mutate({ supplierId })}>
            {mut.isPending ? "Criando..." : "Criar pedido"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p>Carregando...</p>}
          {pos.map((po: any) => (
            <Link key={po.id} href={`/compras/pedidos/${po.id}`} className="block border rounded p-3 hover:bg-muted">
              <div className="flex justify-between">
                <div className="font-medium">{po.supplier?.name ?? "Sem fornecedor"}</div>
                <div className="text-sm text-muted-foreground">{po.status}</div>
              </div>
              <div className="text-sm text-muted-foreground">
                Itens: {po.itemsCount} · Total: R$ {Number(po.total ?? 0).toFixed(2)}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
