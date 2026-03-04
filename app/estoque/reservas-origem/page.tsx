"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";

type Row = {
  orderId: string;
  orderNumber: string | null;
  orderStatus: string;
  materialId: string;
  reservedNeed: number;
  material?: { id: string; name: string; code: string | null } | null;
};

function n(x: any) { return Number(x ?? 0); }

async function fetchRows(params: { q?: string; take?: number }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  sp.set("take", String(params.take ?? 80));

  const res = await fetch(`/api/stock/reservations/by-order?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar reservas por origem");
  return data as { ok: boolean; rows: Row[] };
}

export default function EstoqueReservasOrigemPage() {
  const [q, setQ] = React.useState("");

  const qry = useQuery({
    queryKey: ["stock-reservations-by-order", q],
    queryFn: () => fetchRows({ q: q.trim() || undefined, take: 120 }),
  });

  const rows = qry.data?.rows ?? [];

  const columns: Column<Row>[] = [
    {
      key: "order",
      header: "Pedido",
      headerClassName: "w-[220px]",
      cell: (r) => (
        <div className="min-w-[220px]">
          <div className="font-medium">{r.orderNumber ?? r.orderId}</div>
          <div className="text-xs text-muted-foreground">Status: {r.orderStatus}</div>
        </div>
      ),
    },
    {
      key: "material",
      header: "Material",
      cell: (r) => (
        <div className="min-w-[360px]">
          <div className="font-medium">{r.material?.name ?? r.materialId}</div>
          <div className="text-xs text-muted-foreground">
            {r.material?.code ? `Código: ${r.material.code} · ` : null}
            ID: {r.materialId}
          </div>
        </div>
      ),
    },
    {
      key: "need",
      header: "Reserva (calc)",
      headerClassName: "w-[140px]",
      className: "text-right tabular-nums",
      cell: (r) => n(r.reservedNeed).toLocaleString("pt-BR", { maximumFractionDigits: 4 }),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[180px]",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Link href={`/pedidos/${r.orderId}`} onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary">Abrir pedido</Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Reservas por origem (Pedidos)"
        subtitle="Estimativa por BOM dos pedidos ativos — útil para ver quem está segurando reserva."
        actions={
          <Link href="/estoque/reservas">
            <Button variant="secondary">Ver por material</Button>
          </Link>
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
                {qry.isFetching ? "Atualizando…" : `Itens: ${rows.length}`}
              </div>
            }
            rightSlot={
              <Button variant="secondary" onClick={() => qry.refetch()}>
                Recarregar
              </Button>
            }
          />
        </CardContent>
      </Card>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => `${r.orderId}:${r.materialId}`}
        emptyTitle={qry.isLoading ? "Carregando..." : "Sem reservas calculadas"}
        emptyHint={qry.isLoading ? "Buscando dados…" : "Não há pedidos ativos com BOM/itens suficientes para calcular reserva."}
      />
    </div>
  );
}
