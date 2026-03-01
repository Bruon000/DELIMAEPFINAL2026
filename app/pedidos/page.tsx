"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function fetchOrders() {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("Erro ao carregar pedidos");
  return res.json();
}

export default function PedidosPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["orders"], queryFn: fetchOrders });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <Button asChild><Link href="/pedidos/novo">Novo pedido</Link></Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p>Carregando...</p>}
          {error && <p className="text-red-600">Erro ao carregar.</p>}
          {(data?.orders ?? []).map((o: any) => (
            <Link key={o.id} href={`/pedidos/${o.id}`} className="block border rounded p-3 hover:bg-muted">
              <div className="flex justify-between">
                <div className="font-medium">{o.client?.name ?? "Sem cliente"}</div>
                <div className="text-sm text-muted-foreground">{o.status}</div>
              </div>
              <div className="text-sm text-muted-foreground">
                Itens: {o.itemsCount} · Total: R$ {Number(o.total ?? 0).toFixed(2)}
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
