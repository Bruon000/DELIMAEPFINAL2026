"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Download,
  Loader2,
  Receipt,
  Wallet,
  Printer,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/erp/data-table";
import { Badge } from "@/components/ui/badge";

type AR = {
  id: string;
  orderId: string;
  orderNumber: string | null;
  client: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  dueDate: string;
  amount: number;
  paidAmount: number | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

const PAYMENT_METHODS = [
  { value: "", label: "—" },
  { value: "PIX", label: "PIX" },
  { value: "Dinheiro", label: "Dinheiro" },
  { value: "Cartão", label: "Cartão" },
  { value: "Transferência", label: "Transferência" },
  { value: "Boleto", label: "Boleto" },
];

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

async function fetchARs(params: { status?: string; dueFilter?: string; from?: string; to?: string; vendedorId?: string; q?: string }) {
  const sp = new URLSearchParams();
  sp.set("status", params.status ?? "PENDING");
  if (params.dueFilter) sp.set("dueFilter", params.dueFilter);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.vendedorId) sp.set("vendedorId", params.vendedorId);
  if (params.q) sp.set("q", params.q);
  const res = await fetch(`/api/accounts-receivable?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Erro ao carregar");
  return data as { ars: AR[]; vendedores: { id: string; name: string }[] };
}

async function fetchCashSession() {
  const res = await fetch("/api/cash/session");
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.cashSession ?? null;
}

async function markPaid(id: string, payload: { paidAt?: string; note?: string; paymentMethod?: string }) {
  const res = await fetch(`/api/accounts-receivable/${id}/mark-paid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Erro ao registrar");
  return data;
}

async function createInvoice(orderId: string) {
  const res = await fetch("/api/fiscal/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao emitir nota");
  return data;
}

function printRecibos(ars: AR[]) {
  if (ars.length === 0) return;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recibos</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12px; padding: 16px; color: #111; }
    .recibo { border: 1px solid #ccc; padding: 20px; margin-bottom: 24px; page-break-after: always; max-width: 400px; }
    .recibo:last-child { page-break-after: auto; }
    h2 { margin: 0 0 16px 0; font-size: 16px; border-bottom: 1px solid #333; padding-bottom: 8px; }
    .row { display: flex; justify-content: space-between; margin: 6px 0; }
    .label { color: #666; }
    .valor { font-weight: 600; }
    @media print { body { padding: 0; } .recibo { box-shadow: none; } }
  </style>
</head>
<body>
  ${ars
    .map(
      (ar) => `
  <div class="recibo">
    <h2>RECIBO DE PAGAMENTO</h2>
    <div class="row"><span class="label">Cliente</span><span>${(ar.client?.name ?? "—").replace(/</g, "&lt;")}</span></div>
    <div class="row"><span class="label">Pedido</span><span>${(ar.orderNumber ?? ar.orderId).replace(/</g, "&lt;")}</span></div>
    <div class="row"><span class="label">Vencimento</span><span>${fmtDate(ar.dueDate)}</span></div>
    <div class="row"><span class="label">Valor</span><span class="valor">${fmtMoney(ar.amount)}</span></div>
    <div class="row"><span class="label">Status</span><span>${ar.status === "PAID" ? "Pago" : "Pendente"}</span></div>
    ${ar.paidAt ? `<div class="row"><span class="label">Pago em</span><span>${fmtDate(ar.paidAt)}</span></div>` : ""}
  </div>
  `
    )
    .join("")}
</body>
</html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    w.close();
  }, 300);
}

function exportCSV(rows: AR[]) {
  const headers = ["Pedido", "Cliente", "Vencimento", "Valor", "Status", "Vendedor"];
  const lines = [headers.join(";")];
  for (const ar of rows) {
    lines.push([
      ar.orderNumber ?? ar.orderId,
      ar.client?.name ?? "",
      fmtDate(ar.dueDate),
      ar.amount.toFixed(2).replace(".", ","),
      ar.status,
      ar.createdBy?.name ?? "",
    ].join(";"));
  }
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contas-a-receber-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function RecebimentosContent() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState("PENDING");
  const [dueFilter, setDueFilter] = React.useState(""); // "" | "overdue" | "dueToday"
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const searchParams = useSearchParams();
  const [vendedorId, setVendedorId] = React.useState("");
  const [modalOpen, setModalOpen] = React.useState(false);
  React.useEffect(() => {
    const v = searchParams.get("vendedorId");
    if (v != null) setVendedorId(v);
  }, [searchParams]);
  const [selectedAR, setSelectedAR] = React.useState<AR | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [paidAt, setPaidAt] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const queryParams = React.useMemo(
    () => ({ status: status === "ALL" ? undefined : status, dueFilter: dueFilter || undefined, from: from || undefined, to: to || undefined, vendedorId: vendedorId || undefined, q: q.trim() || undefined }),
    [status, dueFilter, from, to, vendedorId, q],
  );

  const todayStr = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    const dueStr = String(dueDate).slice(0, 10);
    return dueStr < todayStr; // vencido = antes de hoje (não inclui "vence hoje")
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["accounts-receivable", queryParams],
    queryFn: () => fetchARs(queryParams),
  });

  const cashQ = useQuery({ queryKey: ["cash-session"], queryFn: fetchCashSession });
  const cashOpen = Boolean(cashQ.data);

  const ars = data?.ars ?? [];
  const vendedores = data?.vendedores ?? [];

  const handleOpenModal = (ar: AR | null, bulkIds?: string[]) => {
    setSelectedAR(ar);
    if (bulkIds?.length) setSelectedIds(new Set(bulkIds));
    else setSelectedIds(new Set());
    setPaidAt(new Date().toISOString().slice(0, 10));
    setNote("");
    setPaymentMethod("");
    setModalOpen(true);
  };

  const handleConfirmReceive = async () => {
    const dateToSend = paidAt && paidAt.trim() ? paidAt.trim() : new Date().toISOString().slice(0, 10);
    const payload = { paidAt: dateToSend, note: note.trim() || undefined, paymentMethod: paymentMethod || undefined };
    const arsToPay = selectedAR ? [selectedAR] : ars.filter((a) => selectedIds.has(a.id));
    const ids = arsToPay.map((a) => a.id);
    if (ids.length === 0) return;
    setIsSubmitting(true);
    setModalOpen(false);
    setSelectedAR(null);
    setSelectedIds(new Set());
    try {
      for (const id of ids) {
        await markPaid(id, payload);
      }
      const uniqueOrderIds = Array.from(new Set(arsToPay.map((a) => a.orderId)));
      if (uniqueOrderIds.length > 0) {
        for (const orderId of uniqueOrderIds) {
          try {
            await createInvoice(orderId);
          } catch (e: any) {
            toast.error(`Pedido ${orderId.slice(0, 8)}: ${e?.message ?? "Erro ao emitir nota"}`);
          }
        }
      }
      toast.success(ids.length === 1 ? "Recebimento registrado. Nota fiscal criada." : `${ids.length} recebimentos registrados. Notas fiscais criadas.`);
      setStatus("PAID");
      await qc.invalidateQueries({ queryKey: ["accounts-receivable"] });
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const columns: Column<AR>[] = [
    {
      key: "select",
      header: "",
      headerClassName: "w-10",
      cell: (r) =>
        r.status !== "PAID" ? (
          <input
            type="checkbox"
            checked={selectedIds.has(r.id)}
            onChange={(e) => toggleSelect(r.id, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : null,
    },
    { key: "order", header: "Pedido", cell: (r) => <span className="font-medium">{r.orderNumber ?? r.orderId.slice(0, 8)}</span> },
    { key: "client", header: "Cliente", cell: (r) => <span>{r.client?.name ?? "—"}</span> },
    {
      key: "dueDate",
      header: "Vencimento",
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">{fmtDate(r.dueDate)}</span>
          {r.status !== "PAID" && isOverdue(r.dueDate) && (
            <Badge variant="destructive" className="text-[10px]">Vencido</Badge>
          )}
        </div>
      ),
    },
    { key: "amount", header: "Valor", cell: (r) => <span className="tabular-nums font-medium">{fmtMoney(r.amount)}</span>, className: "text-right", headerClassName: "text-right" },
    { key: "status", header: "Status", cell: (r) => <Badge variant={r.status === "PAID" ? "default" : r.status !== "PAID" && isOverdue(r.dueDate) ? "destructive" : "secondary"}>{r.status === "PAID" ? "Pago" : isOverdue(r.dueDate) ? "Vencido" : "Pendente"}</Badge> },
    { key: "paidAt", header: "Pago em", headerClassName: "w-[110px]", cell: (r) => (r.status === "PAID" && r.paidAt ? <span className="tabular-nums">{fmtDate(r.paidAt)}</span> : "—") },
    { key: "vendedor", header: "Vendedor", cell: (r) => <span className="text-sm text-muted-foreground">{r.createdBy?.name ?? "—"}</span> },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[200px]",
      className: "text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => printRecibos([r])}
            title="Imprimir recibo"
          >
            <Printer className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={r.status === "PAID"}
            onClick={() => handleOpenModal(r)}
          >
            <Receipt className="mr-1 h-3.5 w-3.5" />
            Receber
          </Button>
        </div>
      ),
    },
  ];

  const pending = ars.filter((x) => x.status !== "PAID");

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Contas a Receber"
        subtitle="Registre recebimentos e filtre por vencimento, status e vendedor. O valor é lançado na mesma sessão de caixa do PDV (veja movimentos em Abrir/Fechar Caixa)."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => printRecibos(selectedIds.size > 0 ? ars.filter((x) => selectedIds.has(x.id)) : ars)}
              disabled={ars.length === 0}
            >
              <Printer className="mr-1 h-4 w-4" />
              Imprimir recibo(s)
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCSV(ars)} disabled={ars.length === 0}>
              <Download className="mr-1 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        }
      />

      {!cashOpen && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800">Abra o caixa para registrar recebimentos (o valor será lançado na sessão de caixa).</span>
            <Button size="sm" variant="outline" asChild>
              <a href="/financeiro/caixa">Abrir Caixa</a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente, pedido, vendedor..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setDueFilter(""); }}>
                <option value="ALL">Todos</option>
                <option value="PENDING">Pendentes</option>
                <option value="PAID">Pagos</option>
              </select>
              {status === "PENDING" || status === "ALL" ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={dueFilter === "overdue" ? "default" : "outline"}
                    className="h-9"
                    onClick={() => setDueFilter(dueFilter === "overdue" ? "" : "overdue")}
                  >
                    <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                    Vencidos
                  </Button>
                  <Button
                    size="sm"
                    variant={dueFilter === "dueToday" ? "default" : "outline"}
                    className="h-9"
                    onClick={() => setDueFilter(dueFilter === "dueToday" ? "" : "dueToday")}
                  >
                    <CalendarClock className="mr-1 h-3.5 w-3.5" />
                    Vence hoje
                  </Button>
                </div>
              ) : null}
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input type="date" className="h-9 w-[130px]" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input type="date" className="h-9 w-[130px]" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <select className="h-9 rounded-md border bg-background px-2 text-sm min-w-[140px]" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
                <option value="">Todos os vendedores</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          {pending.length > 0 && cashOpen && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.size === pending.length && pending.length > 0}
                onChange={(e) => setSelectedIds(e.target.checked ? new Set(pending.map((x) => x.id)) : new Set())}
              />
              <span className="text-sm text-muted-foreground">Selecionar todos pendentes</span>
              <Button size="sm" variant="secondary" onClick={() => handleOpenModal(null, Array.from(selectedIds))} disabled={selectedIds.size === 0}>
                Receber selecionados ({selectedIds.size})
              </Button>
            </div>
          )}

          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

          {!isLoading && !error && (
            <DataTable
              rows={ars}
              columns={columns}
              rowKey={(r) => r.id}
              emptyTitle="Nenhuma conta a receber"
              emptyHint="Ajuste os filtros ou aguarde novos pedidos confirmados."
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar recebimento</DialogTitle>
            <DialogDescription>
              {selectedAR ? `Pedido ${selectedAR.orderNumber ?? selectedAR.orderId} · ${fmtMoney(selectedAR.amount)}` : `${selectedIds.size} item(ns) selecionado(s).`}
              {cashOpen ? " O valor será lançado na sessão de caixa atual." : " Abra o caixa para lançar o valor."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Data do recebimento</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
              <p className="text-xs text-muted-foreground">Usada para todos os itens selecionados. Em branco = data de hoje.</p>
            </div>
            <div className="grid gap-2">
              <Label>Forma de pagamento</Label>
              <select className="h-9 w-full rounded-md border bg-background px-3" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((opt) => (
                  <option key={opt.value || "x"} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Conta / Caixa</Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" />
                {cashOpen ? "Caixa (sessão atual)" : "Abra o caixa em Financeiro → Caixa"}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Observações</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
            </div>
            <p className="text-xs text-muted-foreground">Será emitida nota fiscal para o(s) pedido(s) após registrar o recebimento.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmReceive} disabled={!cashOpen || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Registrando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RecebimentosPage() {
  return (
    <React.Suspense fallback={<div className="p-6 flex items-center justify-center">Carregando...</div>}>
      <RecebimentosContent />
    </React.Suspense>
  );
}
