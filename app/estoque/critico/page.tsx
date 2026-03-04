"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Row = {
  materialId: string;
  minStock: number;
  quantity: number;
  reserved: number;
  available: number;
  critical: boolean;
  material?: { id: string; name: string; code: string | null } | null;
};

function n(x: any) { return Number(x ?? 0); }

async function fetchCritical(q: string, mode: "available" | "total") {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set("q", q.trim());
  sp.set("mode", mode);
  sp.set("take", "300");

  const res = await fetch(`/api/stock/critical?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar estoque crítico");
  return data as { ok: boolean; rows: Row[] };
}

export default function EstoqueCriticoPage() {
  const [q, setQ] = React.useState("");
  const [mode, setMode] = React.useState<"available" | "total">("available");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["stock-critical", q, mode],
    queryFn: () => fetchCritical(q, mode),
  });

  const rows = data?.rows ?? [];

  const columns: Column<Row>[] = [
    {
      key: "material",
      header: "Material",
      cell: (r) => (
        <div className="min-w-[340px]">
          <div className="font-medium">{r.material?.name ?? r.materialId}</div>
          <div className="text-xs text-muted-foreground">
            {r.material?.code ? `Código: ${r.material.code} · ` : null}
            ID: {r.materialId}
          </div>
        </div>
      ),
    },
    {
      key: "min",
      header: "Mínimo",
      headerClassName: "w-[110px]",
      className: "text-right tabular-nums",
      cell: (r) => n(r.minStock).toLocaleString("pt-BR"),
    },
    {
      key: "available",
      header: "Disponível",
      headerClassName: "w-[120px]",
      className: "text-right tabular-nums",
      cell: (r) => n(r.available).toLocaleString("pt-BR"),
    },
    {
      key: "qty",
      header: "Saldo",
      headerClassName: "w-[110px]",
      className: "text-right tabular-nums",
      cell: (r) => n(r.quantity).toLocaleString("pt-BR"),
    },
    {
      key: "res",
      header: "Reservado",
      headerClassName: "w-[120px]",
      className: "text-right tabular-nums",
      cell: (r) => n(r.reserved).toLocaleString("pt-BR"),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Estoque crítico"
        subtitle="Materiais abaixo do mínimo (minStock)."
        actions={
          <Button variant="secondary" onClick={() => refetch()}>
            {isFetching ? "Atualizando..." : "Recarregar"}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FiltersShell
            search={q}
            onSearchChange={setQ}
            onClearAll={() => setQ("")}
            leftSlot={
              <div className="flex items-center gap-2">
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "available" | "total")}
                >
                  <option value="available">Criticidade por disponível</option>
                  <option value="total">Criticidade por saldo total</option>
                </select>
                <div className="text-xs text-muted-foreground">
                  {isLoading ? "Carregando..." : `Itens críticos: ${rows.length}`}
                </div>
              </div>
            }
            rightSlot={null}
          />
          {error ? <p className="text-sm text-red-600">{(error as any)?.message ?? "Erro"}</p> : null}
        </CardContent>
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.materialId}
        emptyTitle={isLoading ? "Carregando..." : "Sem itens críticos"}
        emptyHint={isLoading ? "Buscando dados…" : "Nenhum material está abaixo do mínimo."}
      />
    </div>
  );
}
