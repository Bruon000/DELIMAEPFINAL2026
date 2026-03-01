"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Product = {
  id: string;
  name: string;
  code?: string | null;
  salePrice?: number | null;
  costPrice?: number | null;
  type?: string | null;
  isActive: boolean;
};

async function fetchProducts(): Promise<Product[]> {
  const res = await fetch("/api/products");
  if (!res.ok) throw new Error("Erro ao carregar produtos");
  const data = await res.json();
  return data.products ?? [];
}

async function createProduct(payload: any) {
  const res = await fetch("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
  return data.product;
}

async function updateProduct(id: string, payload: any) {
  const res = await fetch(`/api/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
  return data.product;
}

async function deleteProduct(id: string) {
  const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao remover");
  return data;
}

export default function ProdutosPage() {
  const qc = useQueryClient();
  const { data: products, isLoading } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const [form, setForm] = React.useState({ name: "", code: "", salePrice: 0, costPrice: 0, type: "COMPOSTO" });
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: createProduct,
    onSuccess: async () => {
      setMsg("Produto criado!");
      setForm({ name: "", code: "", salePrice: 0, costPrice: 0, type: "COMPOSTO" });
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: any) => updateProduct(id, payload),
    onSuccess: async () => {
      setMsg("Produto atualizado!");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      setMsg("Produto removido!");
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const current = editing ?? (form as any);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Produtos</h1>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>{editing ? "Editar produto" : "Novo produto"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Nome" value={current.name ?? ""} onChange={(e) => {
              const v = e.target.value;
              editing ? setEditing({ ...editing, name: v }) : setForm({ ...form, name: v });
            }} />
            <Input placeholder="Código" value={current.code ?? ""} onChange={(e) => {
              const v = e.target.value;
              editing ? setEditing({ ...editing, code: v }) : setForm({ ...form, code: v });
            }} />
            <Input placeholder="Preço venda" type="number" value={Number(current.salePrice ?? 0)} onChange={(e) => {
              const v = Number(e.target.value);
              editing ? setEditing({ ...editing, salePrice: v }) : setForm({ ...form, salePrice: v });
            }} />
            <Input placeholder="Custo" type="number" value={Number(current.costPrice ?? 0)} onChange={(e) => {
              const v = Number(e.target.value);
              editing ? setEditing({ ...editing, costPrice: v }) : setForm({ ...form, costPrice: v });
            }} />
            <Input placeholder="Tipo (COMPOSTO/SIMPLES)" value={String(current.type ?? "COMPOSTO")} onChange={(e) => {
              const v = e.target.value;
              editing ? setEditing({ ...editing, type: v }) : setForm({ ...form, type: v });
            }} />
          </div>

          <div className="flex gap-2">
            {!editing ? (
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name.trim()}>
                {createMut.isPending ? "Salvando..." : "Criar"}
              </Button>
            ) : (
              <>
                <Button onClick={() => updateMut.mutate({ id: editing.id, payload: editing })} disabled={updateMut.isPending || !editing.name.trim()}>
                  {updateMut.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p>Carregando...</p>}
          {(products ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">
                  {p.code ? `${p.code} - ` : ""}{p.name} {!p.isActive && <span className="text-xs text-muted-foreground">(inativo)</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  Venda: R$ {Number(p.salePrice ?? 0).toFixed(2)} · Custo: R$ {Number(p.costPrice ?? 0).toFixed(2)} · Tipo: {p.type}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Editar</Button>
                <Button variant="destructive" size="sm" onClick={() => delMut.mutate(p.id)} disabled={delMut.isPending}>Remover</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
