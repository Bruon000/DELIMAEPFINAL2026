"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchMaterials() {
  const res = await fetch("/api/materials");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar materiais");
  return data as { materials: any[] };
}

export default function EstoqueMateriaisPage() {
  const q = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });
  const [search, setSearch] = React.useState("");

    const materials = React.useMemo(() => {
    return q.data?.materials ?? [];
  }, [q.data?.materials]);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return materials;
    return materials.filter((m: any) => {
      const name = String(m?.name ?? "").toLowerCase();
      const code = String(m?.code ?? "").toLowerCase();
      const unit = String(m?.unit?.code ?? "").toLowerCase();
      return name.includes(needle) || code.includes(needle) || unit.includes(needle);
    });
  }, [materials, search]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estoque · Materiais (Somente leitura)</h1>
        <Button asChild variant="outline">
          <Link href="/estoque">Voltar</Link>
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Buscar</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Buscar por nome / código / unidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="text-xs text-muted-foreground">
            {q.isLoading ? "Carregando..." : `Itens: ${filtered.length}`}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {q.isLoading ? <p>Carregando...</p> : null}
          {q.isError ? <p className="text-red-600">Erro: {(q.error as any)?.message ?? "Falha"}</p> : null}

          {!q.isLoading && filtered.length === 0 ? (
            <p className="text-muted-foreground">Sem materiais.</p>
          ) : null}

          {filtered.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{m.code ? `${m.code} - ` : ""}{m.name}</div>
                <div className="text-sm text-muted-foreground">
                  Unidade: {m.unit?.code ?? "—"} · Custo: R$ {Number(m.currentCost ?? 0).toFixed(2)} · Min: {m.minStock ?? "-"}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Somente leitura</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

