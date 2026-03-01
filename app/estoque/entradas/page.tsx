"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchMaterials() {
  const res = await fetch("/api/materials");
  if (!res.ok) throw new Error("Erro ao carregar materiais");
  return res.json();
}

async function receive(payload: any) {
  const res = await fetch("/api/stock/receive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao lançar entrada");
  return data;
}

export default function EntradasPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });

  const [materialId, setMaterialId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);

  const mut = useMutation({
    mutationFn: receive,
    onSuccess: async () => {
      setMsg("Entrada registrada (RECEIVED).");
      setMaterialId("");
      setQuantity(1);
      setReference("");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.invalidateQueries({ queryKey: ["stock-ledger"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Entrada de Estoque</h1>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Lançar entrada (RECEIVED)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <select className="border rounded p-2 w-full" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">Material…</option>
            {(data?.materials ?? []).map((m: any) => (
              <option key={m.id} value={m.id}>{m.code ? `${m.code} - ` : ""}{m.name}</option>
            ))}
          </select>

          <div className="grid gap-3 md:grid-cols-2">
            <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            <Input placeholder="Referência (opcional: NF, compra, etc)" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          <Input placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />

          <Button disabled={!materialId || quantity <= 0 || mut.isPending} onClick={() => mut.mutate({ materialId, quantity, reference, note })}>
            {mut.isPending ? "Registrando..." : "Registrar entrada"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
