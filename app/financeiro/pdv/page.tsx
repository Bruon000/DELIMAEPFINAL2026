"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/erp/page-header";
import { DataTable, type Column } from "@/components/erp/data-table";

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}
function brl(v: any) {
  const x = n(v);
  return x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function fetchPdvOrders(params: { q?: string }) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  const res = await fetch(`/api/pdv/orders?${sp.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar PDV");
  return data as { orders: any[] };
}

async function fetchPdvOrder(id: string) {
  const res = await fetch(`/api/pdv/orders/${id}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar pedido");
  return data as { order: any };
}

async function createWalkinOrder(payload?: { paymentMethod?: string; cardBrand?: string; installments?: number; paymentNote?: string }) {
  const res = await fetch("/api/pdv/walkin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao criar venda balcão");
  return data as { ok: boolean; id: string };
}

async function createAR(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}/create-ar`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao criar AR");
  return data as { ok: boolean; accountsReceivableId: string; status?: string; amount?: any };
}

async function receiveAR(payload: { accountsReceivableId: string; note?: string }) {
  const res = await fetch("/api/cash/receive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao receber");
  return data;
}

async function createInvoice(orderId: string, docType?: string) {
  const res = await fetch("/api/fiscal/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, docType: docType || undefined }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao criar documento fiscal");
  return data as any;
}

async function emitInvoice(id: string) {
  const res = await fetch(`/api/fiscal/invoices/${id}/emit`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao emitir");
  return data;
}

async function confirmOrder(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}/confirm`, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao confirmar");
  return data;
}

export default function PdvPage() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["pdv-orders", { q }],
    queryFn: () => fetchPdvOrders({ q: q.trim() || undefined }),
  });
  const orders = listQ.data?.orders ?? [];

  const orderQ = useQuery({
    queryKey: ["pdv-order", { id: selectedId }],
    queryFn: () => fetchPdvOrder(String(selectedId)),
    enabled: Boolean(selectedId),
  });
  const order = orderQ.data?.order ?? null;

  const [arId, setArId] = React.useState<string>("");
  const [recvNote, setRecvNote] = React.useState("");
  const [invoiceId, setInvoiceId] = React.useState<string>("");

  React.useEffect(() => {
    setArId("");
    setInvoiceId("");
    setRecvNote("");
  }, [selectedId]);

  const total = React.useMemo(() => {
    const items = order?.items ?? [];
    return items.reduce((s: number, it: any) => s + n(it.total), 0);
  }, [order]);

  const cols: Column<any>[] = [
    { key: "sentToCashierAt", header: "Enviado", cell: (r) => new Date(r.sentToCashierAt).toLocaleString("pt-BR") },
    { key: "client", header: "Cliente", cell: (r) => r.client?.name ?? "—" },
    { key: "total", header: "Total", className: "text-right", cell: (r) => <div className="tabular-nums text-right">{brl(r.total)}</div> },
    { key: "doc", header: "Fiscal", cell: (r) => r.requestedDocType ?? "—" },
    {
      key: "actions",
      header: "Ações",
      cell: (r) => (
        <Button variant="outline" size="sm" onClick={() => setSelectedId(r.id)}>
          Abrir
        </Button>
      ),
    },
  ];

  const createArMut = useMutation({
    mutationFn: () => createAR(String(selectedId)),
    onSuccess: (d) => {
      setArId(String(d.accountsReceivableId));
      toast.success("AR pronto para recebimento.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const receiveMut = useMutation({
    mutationFn: () => receiveAR({ accountsReceivableId: arId, note: recvNote.trim() || undefined }),
    onSuccess: async () => {
      toast.success("Pagamento registrado no caixa.");
      await qc.invalidateQueries({ queryKey: ["cash-session"] });
      await qc.invalidateQueries({ queryKey: ["cash-transactions"] });
      await qc.invalidateQueries({ queryKey: ["accounts-receivable"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const createInvMut = useMutation({
    mutationFn: async () => {
      const docType = String(order?.requestedDocType ?? "").trim() || undefined;
      const d = await createInvoice(String(selectedId), docType);
      const id = String(d?.invoice?.id ?? "");
      if (!id) throw new Error("invoice_id_missing");
      setInvoiceId(id);
      return id;
    },
    onSuccess: () => toast.success("Documento fiscal criado (DRAFT)."),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const emitInvMut = useMutation({
    mutationFn: () => emitInvoice(invoiceId),
    onSuccess: () => toast.success("Emissão disparada (veja status em Fiscal > Documentos)."),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const confirmMut = useMutation({
    mutationFn: () => confirmOrder(String(selectedId)),
    onSuccess: async () => {
      toast.success("Venda confirmada. OP criada e estoque reservado.");
      setSelectedId(null);
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const walkinMut = useMutation({
    mutationFn: () => createWalkinOrder(),
    onSuccess: async (d) => {
      toast.success("Pedido balcão criado.");
      setSelectedId(d.id);
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="PDV (Caixa)"
        subtitle="Fila de pedidos enviados ao caixa"
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => walkinMut.mutate()}
              disabled={walkinMut.isPending}
              title="Cria pedido balcão (cliente sem cadastro) e marca NFCE"
            >
              {walkinMut.isPending ? "Criando..." : "Balcão (NFCE)"}
            </Button>
            <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["pdv-orders"] })}>
              Atualizar
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_520px]">
        <Card>
          <CardHeader>
            <CardTitle>Fila do Caixa (Pedidos DRAFT enviados)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Buscar por cliente / id / doc..." value={q} onChange={(e) => setQ(e.target.value)} />
            <DataTable rows={orders} columns={cols} rowKey={(r) => r.id} emptyTitle="Sem pedidos" emptyHint="Nenhum pedido enviado ao caixa ainda." />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Detalhe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedId ? (
              <div className="text-sm text-muted-foreground">Selecione um pedido na fila.</div>
            ) : orderQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : !order ? (
              <div className="text-sm text-muted-foreground">Pedido não encontrado.</div>
            ) : (
              <>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Pedido</div>
                  <div className="font-medium">{order.number ?? order.id}</div>
                  <div className="text-xs text-muted-foreground">Cliente: {order.client?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Fiscal desejado: {(order as any).requestedDocType ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">Pagamento: {(order as any).paymentMethod ?? "—"} {(order as any).cardBrand ? `(${(order as any).cardBrand})` : ""}</div>
                </div>

                <div className="rounded-md border">
                  <div className="border-b bg-muted px-3 py-2 text-xs font-medium">Itens</div>
                  {(order.items ?? []).map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm border-b">
                      <div>
                        <div className="font-medium">{it.product?.name ?? it.productId}</div>
                        <div className="text-xs text-muted-foreground">
                          Qtd: {String(it.quantity).replace(".", ",")} · Unit: {brl(it.unitPrice)}
                        </div>
                      </div>
                      <div className="tabular-nums">{brl(it.total)}</div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-3">
                    <div className="text-sm text-muted-foreground">Total</div>
                    <div className="text-lg font-semibold tabular-nums">{brl(total)}</div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button variant="outline" onClick={() => createArMut.mutate()} disabled={createArMut.isPending}>
                    {createArMut.isPending ? "Criando AR..." : "1) Criar AR (para receber)"}
                  </Button>

                  <div className="space-y-1">
                    <Label>AR ID</Label>
                    <Input value={arId} onChange={(e) => setArId(e.target.value)} placeholder="Clique em 'Criar AR' acima" />
                  </div>
                  <div className="space-y-1">
                    <Label>Observação do recebimento</Label>
                    <Input value={recvNote} onChange={(e) => setRecvNote(e.target.value)} placeholder="Ex.: Pix, Visa crédito..." />
                  </div>
                  <Button onClick={() => receiveMut.mutate()} disabled={receiveMut.isPending || !arId.trim()}>
                    {receiveMut.isPending ? "Recebendo..." : "2) Receber (registrar no Caixa)"}
                  </Button>

                  <Button variant="outline" onClick={() => createInvMut.mutate()} disabled={createInvMut.isPending}>
                    {createInvMut.isPending ? "Criando fiscal..." : "3) Criar Documento Fiscal (DRAFT)"}
                  </Button>
                  <div className="space-y-1">
                    <Label>Invoice ID</Label>
                    <Input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="Criar fiscal acima ou colar um ID" />
                  </div>
                  <Button variant="outline" onClick={() => emitInvMut.mutate()} disabled={emitInvMut.isPending || !invoiceId.trim()}>
                    {emitInvMut.isPending ? "Emitindo..." : "4) Emitir (Provider)"}
                  </Button>

                  <Button
                    onClick={() => confirmMut.mutate()}
                    disabled={confirmMut.isPending || !arId.trim()}
                    title={!arId.trim() ? "Primeiro crie/receba o pagamento (AR) antes de confirmar." : "Confirmar cria OP e reserva estoque."}
                  >
                    {confirmMut.isPending ? "Confirmando..." : "5) Confirmar venda (estoque/OP)"}
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    Confirmar = cria OP automaticamente e reserva estoque. Regra NFE: se exigir NFE e não estiver AUTHORIZED, trava (409).
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
