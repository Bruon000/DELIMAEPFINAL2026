"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function fetchARs() {
  const res = await fetch("/api/accounts-receivable?status=PENDING");
  if (!res.ok) throw new Error("Erro ao carregar recebíveis");
  return res.json();
}

async function markPaid(id: string) {
  const res = await fetch(`/api/accounts-receivable/${id}/mark-paid`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao marcar como pago");
  return data;
}

export default function RecebimentosPage() {
  const qc = useQueryClient();
  const [msg, setMsg] = React.useState<string | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ["ars"], queryFn: fetchARs });

  const mut = useMutation({
    mutationFn: (id: string) => markPaid(id),
    onSuccess: async () => {
      setMsg("Pagamento registrado no caixa.");
      await qc.invalidateQueries({ queryKey: ["ars"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Recebimentos</h1>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Contas a Receber (PENDENTES)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p>Carregando...</p>}
          {error && <p className="text-red-600">Erro ao carregar.</p>}

          {(data?.ars ?? []).map((ar: any) => (
            <div key={ar.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{ar.order?.client?.name ?? "Sem cliente"}</div>
                <div className="text-sm text-muted-foreground">
                  Pedido: {ar.orderId} · Valor: R$ {Number(ar.amount ?? 0).toFixed(2)}
                </div>
              </div>
              <Button onClick={() => mut.mutate(ar.id)} disabled={mut.isPending}>
                {mut.isPending ? "Processando..." : "Marcar como pago"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
