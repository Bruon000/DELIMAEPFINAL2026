"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function fetchOp(id: string) {
  const res = await fetch(`/api/production-orders/${id}`);
  if (!res.ok) throw new Error("Erro ao carregar OP");
  return res.json();
}

async function startOp(id: string) {
  const res = await fetch(`/api/production-orders/${id}/start`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao iniciar");
  return data;
}

async function finishOp(id: string) {
  const res = await fetch(`/api/production-orders/${id}/finish`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao finalizar");
  return data;
}

export default function OpDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const qc = useQueryClient();
  const [msg, setMsg] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["op", id], queryFn: () => fetchOp(id) });

  const startMut = useMutation({
    mutationFn: () => startOp(id),
    onSuccess: async () => {
      setMsg("OP iniciada.");
      await qc.invalidateQueries({ queryKey: ["op", id] });
      await qc.invalidateQueries({ queryKey: ["ops"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const finishMut = useMutation({
    mutationFn: () => finishOp(id),
    onSuccess: async () => {
      setMsg("OP finalizada e materiais baixados.");
      await qc.invalidateQueries({ queryKey: ["op", id] });
      await qc.invalidateQueries({ queryKey: ["ops"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;
  const op = data?.op;
  if (!op) return <div className="p-6">OP não encontrada.</div>;

  const required = data?.requiredByMaterial ?? {};
  const stock = data?.stock ?? [];
  const stockMap = new Map(stock.map((s: any) => [s.materialId, s]));

  const rows = Object.entries(required).map(([materialId, need]: any) => {
    const s = stockMap.get(materialId);
    const qty = Number(s?.quantity ?? 0);
    const res = Number(s?.reserved ?? 0);
    const available = qty - res;
    const ok = available + 1e-9 >= Number(need);
    return { materialId, need: Number(need), qty, res, available, ok };
  });

  const hasShortage = rows.some((r) => !r.ok);

  const canStart = String(op.status) === "PENDING";
  const canFinish = String(op.status) === "IN_PROGRESS" && !hasShortage;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">OP</h1>

      <Card>
        <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div><b>Status:</b> {op.status}</div>
          <div><b>Pedido:</b> {op.orderId}</div>
          <div><b>Cliente:</b> {op.order?.client?.name ?? "—"}</div>

          <div className="pt-2 flex gap-2 items-center">
            <Button disabled={!canStart || startMut.isPending} onClick={() => startMut.mutate()}>
              {startMut.isPending ? "Iniciando..." : "Iniciar"}
            </Button>

            <Button disabled={!canFinish || finishMut.isPending} onClick={() => finishMut.mutate()}>
              {finishMut.isPending ? "Finalizando..." : "Finalizar (baixar materiais)"}
            </Button>

            {String(op.status) === "IN_PROGRESS" && hasShortage && (
              <span className="text-sm text-red-600">Falta material disponível (estoque - reservado).</span>
            )}
          </div>

          {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Materiais (calculado por BOM)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 && <p className="text-muted-foreground">Sem BOM nos produtos.</p>}

          {rows.map((r) => (
            <div key={r.materialId} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{r.materialId}</div>
                <div className="text-sm text-muted-foreground">
                  Necessário: {r.need.toFixed(4)} · Disponível: {r.available.toFixed(4)} · Estoque: {r.qty.toFixed(4)} · Reservado: {r.res.toFixed(4)}
                </div>
              </div>
              <div className={r.ok ? "text-sm text-green-600" : "text-sm text-red-600"}>
                {r.ok ? "OK" : "FALTA"}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
