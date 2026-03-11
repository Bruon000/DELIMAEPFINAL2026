"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, TrendingDown, ShoppingCart } from "lucide-react";

type Row = {
  materialId: string;
  minStock: number;
  quantity: number;
  reserved: number;
  available: number;
  critical: boolean;
  deficitQty?: number;
  deficitValue?: number;
  unit?: { id: string; code: string | null; name: string } | null;
  material?: { id: string; name: string; code: string | null } | null;
};

type Summary = { totalCritical: number; totalDeficitQty: number; totalDeficitValue: number };

function n(x: any) { return Number(x ?? 0); }

async function fetchCritical(params: { q: string; mode: "available" | "total"; unitId: string }) {
  const sp = new URLSearchParams();
  if (params.q.trim()) sp.set("q", params.q.trim());
  sp.set("mode", params.mode);
  if (params.unitId) sp.set("unitId", params.unitId);
  sp.set("take", "300");

  const res = await fetch(`/api/stock/critical?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar estoque crítico");
  return data as { ok: boolean; rows: Row[]; summary: Summary };
}

async function fetchUnits() {
  const res = await fetch("/api/units");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { units: [] as { id: string; name: string; code: string | null }[] };
  return data as { units: { id: string; name: string; code: string | null }[] };
}

export default function EstoqueCriticoPage() {
  const [q, setQ] = React.useState("");
  const [mode, setMode] = React.useState<"available" | "total">("available");
  const [unitId, setUnitId] = React.useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["stock-critical", q, mode, unitId],
    queryFn: () => fetchCritical({ q, mode, unitId }),
  });

  const { data: unitsData } = useQuery({ queryKey: ["units"], queryFn: fetchUnits });
  const units = unitsData?.units ?? [];

  React.useEffect(() => {
    if (error) {
      const msg = (error as any)?.message ?? "Erro ao carregar estoque crítico";
      toast.error(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const rows = data?.rows ?? [];
  const summary = data?.summary ?? { totalCritical: 0, totalDeficitQty: 0, totalDeficitValue: 0 };

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
    {
      key: "unit",
      header: "Unidade",
      headerClassName: "w-[100px]",
      cell: (r) => r.unit?.name ?? "—",
    },
    {
      key: "solicitar",
      header: "",
      headerClassName: "w-[140px]",
      cell: () => (
        <Link href="/compras/pedidos">
          <Button variant="outline" size="sm">Solicitar compra</Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Estoque crítico"
        subtitle="Materiais abaixo do mínimo (minStock). Use Solicitar compra para abrir um pedido de compra."
        actions={
          <div className="flex gap-2">
            <Link href="/compras/pedidos">
              <Button>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Solicitar compra
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => refetch()}>
              {isFetching ? "Atualizando..." : "Recarregar"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens críticos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCritical}</div>
            <p className="text-xs text-muted-foreground">materiais abaixo do mínimo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quantidade em falta</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalDeficitQty.toLocaleString("pt-BR")}</div>
            <p className="text-xs text-muted-foreground">soma (mín. − disponível)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor estimado em falta</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number(summary.totalDeficitValue).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
            <p className="text-xs text-muted-foreground">custo atual × quantidade em falta</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FiltersShell
            search={q}
            onSearchChange={setQ}
            onClearAll={() => { setQ(""); setUnitId(""); }}
            leftSlot={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "available" | "total")}
                >
                  <option value="available">Criticidade por disponível</option>
                  <option value="total">Criticidade por saldo total</option>
                </select>
                <select
                  className="h-10 rounded-md border bg-background px-3 text-sm min-w-[160px]"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  <option value="">Todas as unidades</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <div className="text-xs text-muted-foreground">
                  {isLoading ? "Carregando..." : `${rows.length} itens críticos`}
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
