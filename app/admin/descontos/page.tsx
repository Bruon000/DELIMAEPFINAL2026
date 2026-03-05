"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function fetchRequests(params: { status?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  const res = await fetch(`/api/admin/discount-requests?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar");
  return data as { ok: boolean; rows: any[] };
}

async function act(payload: { id: string; action: "APPROVE" | "REJECT"; approvedPercent?: number }) {
  const res = await fetch("/api/admin/discount-requests", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao atualizar");
  return data;
}

export default function AdminDescontosPage() {
  const qc = useQueryClient();
  const [status, setStatus] = React.useState("PENDING");
  const [approvedPct, setApprovedPct] = React.useState("10");

  const q = useQuery({
    queryKey: ["discount-requests", { status }],
    queryFn: () => fetchRequests({ status }),
  });

  const rows = q.data?.rows ?? [];

  const mut = useMutation({
    mutationFn: act,
    onSuccess: async () => {
      toast.success("Atualizado.");
      await qc.invalidateQueries({ queryKey: ["discount-requests"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const columns: Column<any>[] = [
    {
      key: "quote",
      header: "Orçamento",
      cell: (r) => (
        <div className="min-w-[320px]">
          <div className="font-medium">{r.quote?.number ? `Orç. ${r.quote.number}` : r.quoteId}</div>
          <div className="text-xs text-muted-foreground">QuoteId: {r.quoteId}</div>
        </div>
      ),
    },
    {
      key: "seller",
      header: "Solicitante",
      cell: (r) => (
        <div>
          <div className="font-medium">{r.requestedBy?.name ?? "-"}</div>
          <div className="text-xs text-muted-foreground">{r.requestedBy?.email ?? ""}</div>
        </div>
      ),
    },
    {
      key: "req",
      header: "Solicitado",
      headerClassName: "w-[120px]",
      className: "text-right tabular-nums",
      cell: (r) => `${Number(r.requestedPercent ?? 0).toFixed(2)}%`,
    },
    {
      key: "reason",
      header: "Motivo",
      cell: (r) => <div className="min-w-[260px] text-sm">{r.reason ?? "-"}</div>,
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[220px]",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              mut.mutate({ id: r.id, action: "APPROVE", approvedPercent: Number(approvedPct ?? 0) });
            }}
            disabled={mut.isPending || String(r.status) !== "PENDING"}
          >
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              mut.mutate({ id: r.id, action: "REJECT" });
            }}
            disabled={mut.isPending || String(r.status) !== "PENDING"}
          >
            Rejeitar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Admin — Aprovação de Descontos"
        subtitle="Pedidos de desconto acima de 5% feitos pelos vendedores."
        actions={
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Aprovar como</Label>
            <Input className="h-10 w-[120px]" type="number" value={approvedPct} onChange={(e) => setApprovedPct(e.target.value)} />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        }
      />

      <FiltersShell
        search=""
        onSearchChange={() => {}}
        onClearAll={() => {}}
        leftSlot={
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="PENDING">PENDENTES</option>
            <option value="APPROVED">APROVADOS</option>
            <option value="REJECTED">REJEITADOS</option>
          </select>
        }
        rightSlot={
          <Button variant="secondary" onClick={() => q.refetch()}>
            Recarregar
          </Button>
        }
      />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle={q.isLoading ? "Carregando..." : "Sem solicitações"}
        emptyHint={q.isLoading ? "Buscando..." : "Quando um vendedor pedir desconto acima de 5%, aparece aqui."}
      />
    </div>
  );
}
