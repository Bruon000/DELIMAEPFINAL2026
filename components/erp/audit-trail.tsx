"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/erp/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [payloadOpen, setPayloadOpen] = React.useState(false);
  const [payloadContent, setPayloadContent] = React.useState<string>("");

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
      headerClassName: "w-[120px]",
      cell: (r) => {
        const hasPayload = r.payload != null && (typeof r.payload === "object" ? Object.keys(r.payload).length > 0 : true);
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              disabled={!hasPayload}
              onClick={(e) => {
                e.stopPropagation();
                setPayloadContent(safeJson(r.payload));
                setPayloadOpen(true);
              }}
            >
              Ver detalhes
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await navigator.clipboard.writeText(safeJson(r.payload));
                  toast.success("Payload copiado.");
                } catch {
                  toast.error("Não foi possível copiar.");
                }
              }}
            >
              Copiar
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
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

      <Dialog open={payloadOpen} onOpenChange={setPayloadOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes do payload</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted/50 p-4 rounded-md overflow-auto flex-1 whitespace-pre-wrap break-words">
            {payloadContent || "—"}
          </pre>
          <Button
            variant="outline"
            size="sm"
            className="self-end"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(payloadContent);
                toast.success("Copiado.");
              } catch {
                toast.error("Não foi possível copiar.");
              }
            }}
          >
            Copiar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
