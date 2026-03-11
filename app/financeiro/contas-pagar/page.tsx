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
import { Wallet, Download } from "lucide-react";

async function fetchPayables(params: { status?: string; from?: string; to?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.status) sp.set("status", params.status);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  const res = await fetch(`/api/accounts-payable?${sp.toString()}`);
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

async function markPaid(id: string, payload?: { paidAt?: string; note?: string }) {
  const res = await fetch(`/api/accounts-payable/${id}/mark-paid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
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

async function updatePayable(id: string, payload: { description?: string; amount?: number; dueDate?: string }) {
  const res = await fetch(`/api/accounts-payable/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao atualizar");
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
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  const [payModalOpen, setPayModalOpen] = React.useState(false);
  const [payId, setPayId] = React.useState<string | null>(null);
  const [payAmount, setPayAmount] = React.useState("");
  const [payDesc, setPayDesc] = React.useState("");
  const [payDate, setPayDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = React.useState("");

  const [editOpen, setEditOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editAmount, setEditAmount] = React.useState("0");
  const [editDesc, setEditDesc] = React.useState("");
  const [editDue, setEditDue] = React.useState("");

  const queryParams = React.useMemo(
    () => ({ status: status === "ALL" ? undefined : status, from: from || undefined, to: to || undefined }),
    [status, from, to],
  );
  const qPay = useQuery({
    queryKey: ["accounts-payable", queryParams],
    queryFn: () => fetchPayables(queryParams),
  });
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
    mutationFn: ({ id, paidAt, note }: { id: string; paidAt?: string; note?: string }) =>
      markPaid(id, paidAt ? { paidAt, note } : undefined),
    onSuccess: async () => {
      toast.success("Pagamento registrado. Saída lançada no caixa.");
      setPayModalOpen(false);
      setPayId(null);
      await qc.invalidateQueries({ queryKey: ["accounts-payable"] });
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
      await qc.invalidateQueries({ queryKey: ["cash-transactions"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao marcar pago"),
  });

  function openPayModal(r: any) {
    setPayId(r.id);
    setPayAmount(String(Number(r.amount ?? 0)));
    setPayDesc(String(r.description ?? ""));
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayNote("");
    setPayModalOpen(true);
  }

  function exportCSV() {
    const rows = filtered;
    const headers = ["Descrição", "Vencimento", "Valor", "Status", "Pago em"];
    const lines = [
      headers.join(";"),
      ...rows.map((r: any) =>
        [
          String(r.description ?? "").replace(/;/g, ","),
          r.dueDate ? new Date(r.dueDate).toLocaleDateString("pt-BR") : "",
          Number(r.amount ?? 0).toFixed(2).replace(".", ","),
          r.status ?? "",
          r.paidAt ? new Date(r.paidAt).toLocaleDateString("pt-BR") : "",
        ].join(";"),
      ),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contas-a-pagar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelPayable(id),
    onSuccess: async () => {
      toast.success("Despesa cancelada.");
      await qc.invalidateQueries({ queryKey: ["accounts-payable"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao cancelar"),
  });

  const editMut = useMutation({
    mutationFn: () => updatePayable(String(editId), { description: editDesc.trim() || undefined, amount: Number(editAmount ?? 0), dueDate: editDue }),
    onSuccess: async () => {
      toast.success("Despesa atualizada.");
      setEditOpen(false);
      setEditId(null);
      await qc.invalidateQueries({ queryKey: ["accounts-payable"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((x: any) => {
      if (!needle) return true;
      const desc = String(x.description ?? "").toLowerCase();
      const id = String(x.id ?? "").toLowerCase();
      return desc.includes(needle) || id.includes(needle);
    });
  }, [items, q]);

  const statusLabel = (s: string) => (s === "OVERDUE" ? "Vencida" : s === "PENDING" ? "Pendente" : s === "PAID" ? "Paga" : s === "CANCELED" ? "Cancelada" : s);

  const columns: Column<any>[] = [
    { key: "desc", header: "Descrição", cell: (r) => <div className="font-medium">{r.description ?? "-"}</div> },
    { key: "due", header: "Venc.", headerClassName: "w-[120px]", cell: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString("pt-BR") : "—" },
    {
      key: "amount",
      header: "Valor",
      headerClassName: "w-[120px]",
      className: "text-right tabular-nums",
      cell: (r) => `R$ ${Number(r.amount ?? 0).toFixed(2)}`,
    },
    {
      key: "pending",
      header: "Valor pendente",
      headerClassName: "w-[120px]",
      className: "text-right tabular-nums",
      cell: (r) => (r.status === "PAID" || r.status === "CANCELED" ? "—" : `R$ ${Number(r.amount ?? 0).toFixed(2)}`),
    },
    { key: "status", header: "Status", headerClassName: "w-[100px]", cell: (r) => statusLabel(r.status ?? "") },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[260px]",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setEditId(r.id);
              setEditDesc(String(r.description ?? ""));
              setEditAmount(String(Number(r.amount ?? 0)));
              const d = r.dueDate ? new Date(r.dueDate) : null;
              const yyyy = d ? String(d.getFullYear()).padStart(4, "0") : "";
              const mm = d ? String(d.getMonth() + 1).padStart(2, "0") : "";
              const dd = d ? String(d.getDate()).padStart(2, "0") : "";
              setEditDue(d ? `${yyyy}-${mm}-${dd}` : "");
              setEditOpen(true);
            }}
          >
            Editar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={String(r.status ?? "") === "PAID" || String(r.status ?? "") === "CANCELED" || paidMut.isPending}
            onClick={(e) => {
              e.stopPropagation();
              openPayModal(r);
            }}
          >
            {String(r.status ?? "") === "PAID" ? "Pago" : "Registrar pagamento"}
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
        subtitle="Despesas, vencimentos e registro de pagamento (saída no caixa)."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download className="mr-1 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button onClick={() => setDlg(true)}>Nova despesa</Button>
          </div>
        }
      />

      <FiltersShell
        search={q}
        onSearchChange={setQ}
        onClearAll={() => { setQ(""); setFrom(""); setTo(""); setStatus("ALL"); }}
        leftSlot={
          <div className="flex flex-wrap items-center gap-2">
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
            <Label className="text-xs text-muted-foreground">Venc. de</Label>
            <Input type="date" className="h-10 w-[140px]" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Label className="text-xs text-muted-foreground">até</Label>
            <Input type="date" className="h-10 w-[140px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
        rightSlot={
          <Button variant="secondary" onClick={() => { setQ(""); setFrom(""); setTo(""); setStatus("ALL"); }}>
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

      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              {payDesc ? `${payDesc} · R$ ${Number(payAmount).toFixed(2)}` : "Registrar saída no caixa."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Data do pagamento</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-1">
              <Label>Conta / Caixa</Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" />
                Caixa (sessão atual) — a saída será lançada no caixa aberto.
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => payId && paidMut.mutate({ id: payId, paidAt: payDate || undefined, note: payNote.trim() || undefined })}
              disabled={paidMut.isPending || !payId}
            >
              {paidMut.isPending ? "Registrando..." : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar despesa</DialogTitle>
            <DialogDescription>
              Atualiza descrição, valor e vencimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor</Label>
              <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Vencimento</Label>
              <Input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => editMut.mutate()} disabled={editMut.isPending || !editId}>
              {editMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
