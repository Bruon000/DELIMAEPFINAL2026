"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
  // Stub 501: tratar como vazio, mas avisar
  if (res.status === 501) return { items: [], message: data?.message ?? "Integração pendente." };
  if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar contas a pagar");
  return data as { items: any[] };
}

export default function ContasPagarPage() {
  const [q, setQ] = React.useState("");
  const [dlg, setDlg] = React.useState(false);
  const [amount, setAmount] = React.useState("0");
  const [desc, setDesc] = React.useState("");
  const [due, setDue] = React.useState("");

  const qPay = useQuery({ queryKey: ["accounts-payable"], queryFn: fetchPayables });
  const items = React.useMemo(() => {
    return qPay.data?.items ?? [];
  }, [qPay.data?.items]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((x: any) => String(x.description ?? "").toLowerCase().includes(needle));
  }, [items, q]);

  const columns: Column<any>[] = [
    { key: "desc", header: "Descrição", cell: (r) => <div className="font-medium">{r.description ?? "-"}</div> },
    { key: "due", header: "Venc.", headerClassName: "w-[140px]", cell: (r) => r.dueDate ? String(r.dueDate) : "—" },
    {
      key: "amount",
      header: "Valor",
      headerClassName: "w-[140px]",
      className: "text-right tabular-nums",
      cell: (r) => `R$ ${Number(r.amount ?? 0).toFixed(2)}`,
    },
    { key: "status", header: "Status", headerClassName: "w-[140px]", cell: (r) => r.status ?? "—" },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Contas a Pagar"
        subtitle="Despesas, vencimentos e marcação de pago (em implementação)."
        actions={
          <Button
            onClick={() => {
              if (qPay.data?.message) toast.info(qPay.data.message);
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
            : "A API de AccountsPayable ainda é stub. Vamos plugar o CRUD real no próximo pacote."
        }
      />

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova despesa</DialogTitle>
            <DialogDescription>
              Cadastro de despesa (stub). No próximo pacote, vamos persistir no banco e permitir marcar pago.
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
              onClick={() => {
                toast.info("Integração pendente: salvar despesa (stub).");
                setDlg(false);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
