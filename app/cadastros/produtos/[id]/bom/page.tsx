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
const [lossItem, setLossItem] = React.useState(0); // % perda por material
const [lossGlobal, setLossGlobal] = React.useState(0); // % perda global do BOM
const [edit, setEdit] = React.useState<Record<string, { quantity: number; lossPercent: number }>>({});
  const [msg, setMsg] = React.useState<string | null>(null);

  const addMut = useMutation({
    mutationFn: (p: any) => addBomItem(productId, p),
    onSuccess: async () => {
      setMsg("Item adicionado!");
      setMaterialId("");
      setQuantity(1);
      setLossItem(0);
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

const saveBomMut = useMutation({
  mutationFn: (p: any) => updateBom(productId, p),
  onSuccess: async () => {
    setMsg("BOM atualizado!");
    await qc.invalidateQueries({ queryKey: ["bom", productId] });
  },
  onError: (e: any) => setMsg(e?.message ?? "Erro"),
});

const saveItemMut = useMutation({
  mutationFn: ({ id, payload }: any) => updateBomItem(id, payload),
  onSuccess: async () => {
    setMsg("Item atualizado!");
    await qc.invalidateQueries({ queryKey: ["bom", productId] });
  },
  onError: (e: any) => setMsg(e?.message ?? "Erro"),
});},
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  if (isLoading) return <div className="p-6">Carregando...</div>;

  const product = data?.product;
  const bom = data?.bom;
  const items = bom?.items ?? [];

React.useEffect(() => {
  setLossGlobal(pct(bom?.lossPercent));
}, [bom?.lossPercent]);

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

<Card>
  <CardHeader><CardTitle>Perdas (padrão industrial)</CardTitle></CardHeader>
  <CardContent className="grid gap-3 md:grid-cols-3 items-end">
    <div className="space-y-1">
      <div className="text-sm font-medium">Perda global (%)</div>
      <Input type="number" step="0.01" value={lossGlobal} onChange={(e) => setLossGlobal(Number(e.target.value))} />
      <div className="text-xs text-muted-foreground">Aplica em todos os materiais (corte/sobra geral).</div>
    </div>
    <div className="md:col-span-2 flex gap-2">
      <Button disabled={saveBomMut.isPending || lossGlobal < 0} onClick={() => saveBomMut.mutate({ lossPercent: lossGlobal })}>
        {saveBomMut.isPending ? "Salvando..." : "Salvar perdas"}
      </Button>
      <Button variant="outline" onClick={() => setLossGlobal(pct(bom?.lossPercent))}>Reverter</Button>
    </div>
  </CardContent>
</Card>

</Card>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Adicionar material</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <select className="border rounded p-2" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            <option value="">Material…</option>
            {(mats?.materials ?? []).map((m: any) => (
              <option key={m.id} value={m.id}>{m.code ? `${m.code} - ` : ""}{m.name}</option>
            ))}
          </select>

          <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
<Input type="number" step="0.01" value={lossItem} onChange={(e) => setLossItem(Number(e.target.value))} placeholder="Perda (%)" />

          <Button disabled={!materialId || quantity <= 0 || addMut.isPending} onClick={() => addMut.mutate({ materialId, quantity, lossPercent: lossItem })}>
            {addMut.isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Itens do BOM</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && <p className="text-muted-foreground">Sem itens ainda.</p>}
          {items.map((it: any) => {
  const e = edit[it.id] ?? { quantity: num(it.quantity), lossPercent: pct(it.lossPercent) };
  const base = e.quantity;
  const finalQty = base * (1 + (lossGlobal / 100)) * (1 + (e.lossPercent / 100));

  return (
    <div key={it.id} className="border rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-medium">{it.material?.name ?? it.materialId}</div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={saveItemMut.isPending}
            onClick={() => saveItemMut.mutate({ id: it.id, payload: { quantity: e.quantity, lossPercent: e.lossPercent } })}
          >
            {saveItemMut.isPending ? "Salvando..." : "Salvar"}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => delMut.mutate(it.id)} disabled={delMut.isPending}>
            Remover
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 items-end">
        <div className="space-y-1">
          <div className="text-sm font-medium">Qtd base</div>
          <Input
            type="number"
            step="0.0001"
            value={e.quantity}
            onChange={(ev) => setEdit({ ...edit, [it.id]: { ...e, quantity: Number(ev.target.value) } })}
          />
        </div>

        <div className="space-y-1">
          <div className="text-sm font-medium">Perda item (%)</div>
          <Input
            type="number"
            step="0.01"
            value={e.lossPercent}
            onChange={(ev) => setEdit({ ...edit, [it.id]: { ...e, lossPercent: Number(ev.target.value) } })}
          />
        </div>

        <div className="md:col-span-2 text-sm text-muted-foreground">
          Qtd final (com perdas): <b>{fmt4(finalQty)}</b>
          <div className="text-xs text-muted-foreground">final = base × (1+perdaGlobal) × (1+perdaItem)</div>
        </div>
      </div>
    </div>
  );
})}
        </CardContent>
      </Card>
    </div>
  );
}
