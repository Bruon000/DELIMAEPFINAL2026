"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function fetchOps(status: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`/api/production-orders${qs}`);
  if (!res.ok) throw new Error("Erro ao carregar OPs");
  return res.json();
}

export default function OpsPage() {
  const [status, setStatus] = React.useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["ops", status],
    queryFn: () => fetchOps(status),
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Ordens de Produção</h1>

      <div className="flex gap-2 items-center">
        <span className="text-sm text-muted-foreground">Status:</span>
        <select className="border rounded p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="PENDING">PENDING</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="DONE">DONE</option>
        </select>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p>Carregando...</p>}
          {(data?.ops ?? []).map((op: any) => (
            <Link key={op.id} href={`/producao/ops/${op.id}`} className="block border rounded p-3 hover:bg-muted">
              <div className="flex justify-between">
                <div className="font-medium">{op.order?.client?.name ?? "Sem cliente"}</div>
                <div className="text-sm text-muted-foreground">{op.status}</div>
              </div>
              <div className="text-sm text-muted-foreground">Pedido: {op.orderId}</div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
