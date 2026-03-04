"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Row = {
  materialId: string;
  quantity: number;
  reserved: number;
  available: number;
  updatedAt: string;
  material?: { id: string; name: string; code: string | null } | null;
};

function n(x: any) { return Number(x ?? 0); }

async function fetchReservations(q: string) {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set("q", q.trim());
  sp.set("onlyPositive", "1");
  sp.set("take", "250");

  const res = await fetch(`/api/stock/reservations?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar reservas");
  return data as { ok: boolean; rows: Row[] };
}

export default function EstoqueReservasPage() {
  const [q, setQ] = React.useState("");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["stock-reservations", q],
    queryFn: () => fetchReservations(q),
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
      key: "qty",
      header: "Saldo",
      headerClassName: "w-[110px]",
      className: "text-right tabular-nums",
      cell: (r) => n(r.quantity).toLocaleString("pt-BR"),
    },
    {
      key: "reserved",
      header: "Reservado",
      headerClassName: "w-[120px]",
      className: "text-right tabular-nums",
      cell: (r) => n(r.reserved).toLocaleString("pt-BR"),
    },
    {
      key: "available",
      header: "Disponível",
      headerClassName: "w-[120px]",
      className: "text-right tabular-nums",
      cell: (r) => n(r.available).toLocaleString("pt-BR"),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[120px]",
      className: "text-right",
      cell: () => (
        <Link href={`/cadastros/materiais`} onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary">Ver materiais</Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Reservas de Estoque"
        subtitle="Visão do reservado vs disponível por material (RESERVED)."
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
              <div className="text-xs text-muted-foreground">
                {isLoading ? "Carregando..." : `Itens com reserva: ${rows.length}`}
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
        emptyTitle={isLoading ? "Carregando..." : "Sem reservas"}
        emptyHint={isLoading ? "Buscando dados…" : "Nenhum material está reservado no momento."}
      />
    </div>
  );
}
