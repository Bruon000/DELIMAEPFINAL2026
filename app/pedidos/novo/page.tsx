"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function fetchClients() {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("Erro ao carregar clientes");
  return res.json();
}

async function createOrder(payload: any) {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Erro ao criar pedido");
  }
  return res.json();
}

export default function NovoPedidoPage() {
  const router = useRouter();
  const { data } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const [clientId, setClientId] = React.useState("");

  const mut = useMutation({
    mutationFn: createOrder,
    onSuccess: (d: any) => router.push(`/pedidos/${d.id}`),
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Novo pedido</h1>

      <Card>
        <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select className="border rounded p-2 w-full" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Selecione…</option>
            {(data?.clients ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <Button onClick={() => mut.mutate({ clientId })} disabled={!clientId || mut.isPending}>
            {mut.isPending ? "Criando..." : "Criar pedido"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
