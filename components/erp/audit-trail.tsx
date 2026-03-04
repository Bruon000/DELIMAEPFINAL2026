"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/erp/data-table";

export type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  entity: string;
  entityId: string;
  createdBy?: string | null;
  user?: { id: string; name?: string | null; email?: string | null } | null;
  payload?: any;
};

function dt(v: any) {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v ?? "");
  return d.toLocaleString("pt-BR");
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return String(v ?? "");
  }
}

export function AuditTrail(props: {
  rows: AuditRow[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
}) {
  const rows = props.rows ?? [];

  const columns: Column<AuditRow>[] = [
    {
      key: "createdAt",
      header: "Data",
      headerClassName: "w-[190px]",
      cell: (r) => <div className="tabular-nums">{dt(r.createdAt)}</div>,
    },
    {
      key: "action",
      header: "Ação",
      headerClassName: "w-[220px]",
      cell: (r) => <div className="font-medium">{String(r.action ?? "")}</div>,
    },
    {
      key: "user",
      header: "Usuário",
      headerClassName: "w-[220px]",
      cell: (r) => {
        const name = r.user?.name ?? r.user?.email ?? r.createdBy ?? "-";
        return <div className="text-sm">{name}</div>;
      },
    },
    {
      key: "entity",
      header: "Entidade",
      headerClassName: "w-[220px]",
      cell: (r) => (
        <div className="text-sm">
          <span className="text-muted-foreground">{r.entity}</span>{" "}
          <span className="font-mono">{r.entityId}</span>
        </div>
      ),
    },
    {
      key: "payload",
      header: "Payload",
      cell: (r) => (
        <div className="min-w-[320px]">
          <div className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap break-words">
            {safeJson(r.payload)}
          </div>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[140px]",
      className: "text-right",
      cell: (r) => (
        <Button
          variant="outline"
          size="sm"
          onClick={async (e) => {
            e.stopPropagation();
            try {
              await navigator.clipboard.writeText(safeJson(r.payload));
              toast.success("Payload copiado.");
            } catch {
              toast.error("Não foi possível copiar para a área de transferência.");
            }
          }}
        >
          Copiar
        </Button>
      ),
    },
  ];

  return (
    <div className="max-h-[520px] overflow-auto">
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle={props.isLoading ? "Carregando..." : props.emptyTitle ?? "Sem auditoria"}
        emptyHint={
          props.isLoading
            ? "Buscando logs…"
            : props.emptyHint ?? "Ainda não há eventos registrados para este item."
        }
      />
    </div>
  );
}
