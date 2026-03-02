"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type OutboxItem = { id: string; kind: "start" | "finish"; opId: string; createdAt: number };

function loadOutbox(): OutboxItem[] {
  try { return JSON.parse(localStorage.getItem("outbox_ops") ?? "[]"); } catch { return []; }
}
function saveOutbox(items: OutboxItem[]) {
  localStorage.setItem("outbox_ops", JSON.stringify(items));
}
function pushOutbox(item: OutboxItem) {
  const items = loadOutbox();
  items.push(item);
  saveOutbox(items);
}
async function flushOutbox() {
  const items = loadOutbox();
  if (!items.length) return { ok: true, done: 0, left: 0 };

  const keep: OutboxItem[] = [];
  let done = 0;

  for (const it of items) {
    try {
      const url = `/api/production-orders/${it.opId}/${it.kind === "start" ? "start" : "finish"}`;
      const res = await fetch(url, { method: "POST" });
      if (!res.ok) throw new Error("fail");
      done++;
    } catch {
      keep.push(it);
    }
  }

  saveOutbox(keep);
  return { ok: keep.length === 0, done, left: keep.length };
}

async function fetchOp(id: string) {
  const res = await fetch(`/api/production-orders/${id}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar OP");
  return data?.op ?? data?.productionOrder ?? data;
}

async function fetchOrder(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar pedido");
  return data?.order ?? data;
}

async function fetchOrderMaterials(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}/materials`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar materiais do pedido");
  return data;
}

async function startOp(id: string) {
  const res = await fetch(`/api/production-orders/${id}/start`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao iniciar");
  return data;
}

async function finishOp(id: string) {
  const res = await fetch(`/api/production-orders/${id}/finish`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao finalizar");
  return data;
}

function Badge({ status }: { status: string }) {
  const s = String(status ?? "").toUpperCase();
  const base = "inline-flex items-center rounded px-2 py-1 text-xs font-medium";
  if (s === "DONE") return <span className={`${base} bg-emerald-100 text-emerald-800`}>DONE</span>;
  if (s === "IN_PROGRESS") return <span className={`${base} bg-blue-100 text-blue-800`}>IN_PROGRESS</span>;
  if (s === "BLOCKED") return <span className={`${base} bg-amber-100 text-amber-800`}>BLOCKED</span>;
  return <span className={`${base} bg-zinc-100 text-zinc-800`}>QUEUED</span>;
}

export default function OpDetailPage() {
  const params = useParams();
  const id = String((params as any)?.id ?? "");
  const qc = useQueryClient();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [isOnline, setIsOnline] = React.useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);

  React.useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    // tenta sincronizar ao voltar online
    flushOutbox().then((r) => { if (r.done > 0) setMsg(`Sincronizado: ${r.done} acao(oes).`); });

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);


  const opQ = useQuery({
    queryKey: ["op", id],
    queryFn: () => fetchOp(id),
    enabled: !!id,
  });

  const op = opQ.data;
  const status = String(op?.status ?? "");
  const orderId = op?.orderId ?? null;

  const orderQ = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(String(orderId)),
    enabled: !!orderId,
  });

  const matsQ = useQuery({
    queryKey: ["order-materials", orderId],
    queryFn: () => fetchOrderMaterials(String(orderId)),
    enabled: !!orderId,
  });

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
      if (orderId) {
        await qc.invalidateQueries({ queryKey: ["order", orderId] });
        await qc.invalidateQueries({ queryKey: ["order-materials", orderId] });
      }
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.invalidateQueries({ queryKey: ["stock-ledger"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  if (opQ.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (opQ.error || !op) {
    return <div className="p-6 text-sm text-red-600">Falha ao carregar OP.</div>;
  }

  const canStart = status === "QUEUED" || status === "BLOCKED";
  const canFinish = status === "IN_PROGRESS";

  const order = orderQ.data ?? null;
  const items = order?.items ?? [];
  const mats = matsQ.data?.materials ?? [];

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">OP {op.id}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge status={status} />{!isOnline ? <span className="ml-2 inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-800">OFFLINE</span> : null}
            {orderId ? (
              <Link href={`/pedidos/${orderId}`} className="text-sm underline text-muted-foreground">
                Ver pedido
              </Link>
            ) : null}
          </div>
          {msg ? <div className="mt-2 text-sm text-muted-foreground">{msg}</div> : null}
        </div>

        <div className="flex gap-2">
          <Button
            disabled={startMut.isPending || !canStart || !isOnline}
            onClick={() => {
              if (!confirm("Iniciar esta OP?")) return;
              if (!isOnline) { pushOutbox({ id: `op_${Date.now()}`, kind: "start", opId: id, createdAt: Date.now() }); setMsg("Offline: acao salva para sincronizar."); return; }
              startMut.mutate();
            }}
          >
            Iniciar
          </Button>

          <Button
            disabled={finishMut.isPending || !canFinish || !isOnline}
            variant="secondary"
            onClick={() => {
              if (!confirm("Finalizar esta OP? Isso vai consumir materiais do estoque.")) return;
              if (!isOnline) { pushOutbox({ id: `op_${Date.now()}`, kind: "finish", opId: id, createdAt: Date.now() }); setMsg("Offline: acao salva para sincronizar."); return; }
              finishMut.mutate();
            }}
          >
            Finalizar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!orderId ? (
            <div className="text-muted-foreground">OP sem pedido vinculado.</div>
          ) : orderQ.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : orderQ.error ? (
            <div className="text-red-600">Falha ao carregar pedido.</div>
          ) : (
            <>
              <div><b>ID:</b> {order?.id ?? "-"}</div>
              <div><b>Número:</b> {order?.number ?? "-"}</div>
              <div><b>Cliente:</b> {order?.client?.name ?? "-"}</div>
              <div><b>Status:</b> {order?.status ?? "-"}</div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens do pedido</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!orderId ? (
            <div className="text-sm text-muted-foreground">Sem pedido.</div>
          ) : orderQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem itens.</div>
          ) : (
            <div className="space-y-2">
              {items.map((it: any) => (
                <div key={it.id} className="flex items-center justify-between border rounded p-2">
                  <div className="font-medium">{it.product?.name ?? "Produto"}</div>
                  <div className="text-sm text-muted-foreground">Qtd: {it.quantity}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Materiais calculados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!orderId ? (
            <div className="text-sm text-muted-foreground">Sem pedido.</div>
          ) : matsQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : matsQ.error ? (
            <div className="text-sm text-red-600">Falha ao carregar materiais.</div>
          ) : mats.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem materiais calculados.</div>
          ) : (
            <div className="space-y-2">
              {mats.map((m: any) => (
                <div key={m.materialId} className="grid grid-cols-5 gap-2 border rounded p-2 text-sm">
                  <div className="col-span-2 font-medium">{m.name}</div>
                  <div>Necessario: {m.need} {m.unit}</div>
                  <div>Disponivel: {m.available} {m.unit}</div>
                  <div className={m.shortage > 0 ? "text-red-600 font-medium" : "text-emerald-700 font-medium"}>
                    Falta: {m.shortage} {m.unit}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



