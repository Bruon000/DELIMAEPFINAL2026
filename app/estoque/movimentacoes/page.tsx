"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchLedger(params: any) {
  const qs = new URLSearchParams();
  if (params.materialId) qs.set("materialId", params.materialId);
  if (params.type) qs.set("type", params.type);
  qs.set("take", "200");

  const res = await fetch(`/api/stock/ledger?${qs.toString()}`);
  if (!res.ok) throw new Error("Erro ao carregar ledger");
  return res.json();
}

export default function MovimentacoesPage() {
  const [materialId, setMaterialId] = React.useState("");
  const [type, setType] = React.useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["stock-ledger", materialId, type],
    queryFn: () => fetchLedger({ materialId, type }),
  });

  const rows = data?.rows ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Movimentações de Estoque</h1>
        <Button asChild variant="outline">
          <Link href="/estoque/entradas">+ Entrada</Link>
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="materialId (opcional)" value={materialId} onChange={(e) => setMaterialId(e.target.value)} />
          <select className="border rounded p-2" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todos</option>
            <option value="RECEIVED">RECEIVED</option>
            <option value="RESERVED">RESERVED</option>
            <option value="CONSUMED">CONSUMED</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
            <option value="RETURN">RETURN</option>
          </select>
          <div className="text-sm text-muted-foreground self-center">Mostrando até 200 itens</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p>Carregando...</p>}
          {error && <p className="text-red-600">Erro ao carregar.</p>}
          {rows.length === 0 && !isLoading && <p className="text-muted-foreground">Sem movimentações.</p>}

          {rows.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">
                  {r.type} · {r.material?.code ? `${r.material.code} - ` : ""}{r.material?.name ?? r.materialId}
                </div>
                <div className="text-sm text-muted-foreground">
                  Qtd: {Number(r.quantity ?? 0).toFixed(4)} · Saldo: {Number(r.balance ?? 0).toFixed(4)}
                  {r.reference ? ` · Ref: ${r.reference}` : ""}{r.note ? ` · ${r.note}` : ""}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
