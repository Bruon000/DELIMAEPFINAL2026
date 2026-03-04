"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

async function fetchPayables() {
  const res = await fetch("/api/accounts-payable");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar contas a pagar");
  return data as { items: any[] };
}

async function createPayable(payload: { description?: string; amount: number; dueDate: string }) {
  const res = await fetch("/api/accounts-payable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Erro ao criar despesa");
  return data as { ok: boolean; id: string };
}

async function markPaid(id: string) {
  const res = await fetch(`/api/accounts-payable/${id}/mark-paid`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao marcar pago");
  return data;
}

async function cancelPayable(id: string) {
  const res = await fetch(`/api/accounts-payable/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "CANCELED" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao cancelar");
  return data;
}

export default function ContasPagarPage() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const [dlg, setDlg] = React.useState(false);
  const [amount, setAmount] = React.useState("0");
  const [desc, setDesc] = React.useState("");
  const [due, setDue] = React.useState("");
  const [status, setStatus] = React.useState<"ALL" | "PENDING" | "PAID" | "OVERDUE" | "CANCELED">("ALL");

  const qPay = useQuery({ queryKey: ["accounts-payable"], queryFn: fetchPayables });
  const items = React.useMemo(() => {
    return qPay.data?.items ?? [];
  }, [qPay.data?.items]);

  const createMut = useMutation({
    mutationFn: () => createPayable({ description: desc.trim() || undefined, amount: Number(amount ?? 0), dueDate: due }),
    onSuccess: async () => {
      toast.success("Despesa criada.");
      setDlg(false);
      setAmount("0");
      setDesc("");
      setDue("");
      await qc.invalidateQueries({ queryKey: ["accounts-payable"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar despesa"),
  });

  const paidMut = useMutation({
    mutationFn: (id: string) => markPaid(id),
    onSuccess: async () => {
      toast.success("Despesa marcada como paga. Saída registrada no Caixa (OUT).");
      await qc.invalidateQueries({ queryKey: ["accounts-payable"] });
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
      await qc.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao marcar pago"),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelPayable(id),
    onSuccess: async () => {
      toast.success("Despesa cancelada.");
      await qc.invalidateQueries({ queryKey: ["accounts-payable"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cancelar"),
  });

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((x: any) => {
      if (status !== "ALL" && String(x.status ?? "") !== status) return false;
      if (!needle) return true;
      return String(x.description ?? "").toLowerCase().includes(needle);
    });
  }, [items, q, status]);

  const columns: Column<any>[] = [
    { key: "desc", header: "Descrição", cell: (r) => <div className="font-medium">{r.description ?? "-"}</div> },
    { key: "due", header: "Venc.", headerClassName: "w-[140px]", cell: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString("pt-BR") : "—" },
    {
      key: "amount",
      header: "Valor",
      headerClassName: "w-[140px]",
      className: "text-right tabular-nums",
      cell: (r) => `R$ ${Number(r.amount ?? 0).toFixed(2)}`,
    },
    { key: "status", header: "Status", headerClassName: "w-[140px]", cell: (r) => r.status ?? "—" },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[160px]",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={String(r.status ?? "") === "PAID" || String(r.status ?? "") === "CANCELED" || paidMut.isPending}
            onClick={(e) => {
              e.stopPropagation();
              paidMut.mutate(r.id);
            }}
          >
            {String(r.status ?? "") === "PAID" ? "Pago" : "Marcar pago"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={String(r.status ?? "") === "PAID" || String(r.status ?? "") === "CANCELED" || cancelMut.isPending}
            onClick={(e) => {
              e.stopPropagation();
              cancelMut.mutate(r.id);
            }}
          >
            Cancelar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Contas a Pagar"
        subtitle="Despesas, vencimentos e marcação de pago."
        actions={
          <Button
            onClick={() => {
              setDlg(true);
            }}
          >
            Nova despesa
          </Button>
        }
      />

      <FiltersShell
        search={q}
        onSearchChange={setQ}
        onClearAll={() => setQ("")}
        leftSlot={
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="ALL">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="OVERDUE">Vencida</option>
            <option value="PAID">Paga</option>
            <option value="CANCELED">Cancelada</option>
          </select>
        }
        rightSlot={
          <Button variant="secondary" onClick={() => setQ("")}>
            Limpar
          </Button>
        }
      />

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.id ?? r.description ?? Math.random().toString(36)}
        emptyTitle={qPay.isLoading ? "Carregando..." : "Sem contas a pagar"}
        emptyHint={
          qPay.isLoading
            ? "Buscando dados…"
            : "Cadastre despesas e marque como pagas para gerar saída no Caixa."
        }
      />

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova despesa</DialogTitle>
            <DialogDescription>
              Cadastro de despesa (PENDING).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vencimento</Label>
              <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDlg(false)}>Cancelar</Button>
            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
            >
              {createMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
