"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchBom(productId: string) {
  const res = await fetch(`/api/products/${productId}/bom`);
  if (!res.ok) throw new Error("Erro ao carregar BOM");
  return res.json();
}

async function fetchMaterials() {
  const res = await fetch(`/api/materials`);
  if (!res.ok) return { materials: [] };
  return res.json();
}

async function addBomItem(productId: string, payload: any) {
  const res = await fetch(`/api/products/${productId}/bom/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao adicionar");
  return data;
}

async function deleteBomItem(id: string) {
  const res = await fetch(`/api/bom-items/${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao remover");
  return data;
}

export default function BomPage() {
  const params = useParams();
  const productId = String(params.id);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["bom", productId], queryFn: () => fetchBom(productId) });
  const { data: mats } = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });

  const [materialId, setMaterialId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [msg, setMsg] = React.useState<string | null>(null);

  const addMut = useMutation({
    mutationFn: (p: any) => addBomItem(productId, p),
    onSuccess: async () => {
      setMsg("Item adicionado!");
      setMaterialId("");
      setQuantity(1);
      await qc.invalidateQueries({ queryKey: ["bom", productId] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteBomItem(id),
    onSuccess: async () => {
      setMsg("Item removido!");
      await qc.invalidateQueries({ queryKey: ["bom", productId] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;

  const product = data?.product;
  const bom = data?.bom;
  const items = bom?.items ?? [];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">BOM do Produto</h1>
        <Button asChild variant="outline">
          <Link href="/cadastros/produtos">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Produto</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <div><b>Nome:</b> {product?.name ?? "—"}</div>
          <div><b>Código:</b> {product?.code ?? "—"}</div>
        </CardContent>
      </Card>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Adicionar material</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <select className="border rounded p-2" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">Material…</option>
            {(mats?.materials ?? []).map((m: any) => (
              <option key={m.id} value={m.id}>{m.code ? `${m.code} - ` : ""}{m.name}</option>
            ))}
          </select>

          <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />

          <Button disabled={!materialId || quantity <= 0 || addMut.isPending} onClick={() => addMut.mutate({ materialId, quantity })}>
            {addMut.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Itens do BOM</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-muted-foreground">Sem itens ainda.</p>}
          {items.map((it: any) => (
            <div key={it.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{it.material?.name ?? it.materialId}</div>
                <div className="text-sm text-muted-foreground">
                  Qtd por produto: {Number(it.quantity ?? 0).toFixed(4)}
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => delMut.mutate(it.id)} disabled={delMut.isPending}>
                Remover
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
