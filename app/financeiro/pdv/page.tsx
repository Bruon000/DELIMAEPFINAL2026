"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const res = await fetch(`/api/ar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao criar AR");
  // /api/ar retorna { ok: true, ar }
  return data as { ok: boolean; ar: any };
}

async function receiveAR(payload: { accountsReceivableId: string; paidAmount?: any }) {
  const res = await fetch(`/api/ar/${payload.accountsReceivableId}/receive`, {
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

  // invoice agora vem do backend (order.lastInvoice). Mantém state só como fallback (ex: logo após criar)
  const [invoiceId, setInvoiceId] = React.useState<string>("");
  React.useEffect(() => setInvoiceId(""), [selectedId]);

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
    onSuccess: async () => {
      toast.success("Recebível criado (PENDING).");
      await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const receiveMut = useMutation({
    mutationFn: () =>
      receiveAR({
        accountsReceivableId: String(order?.ar?.id ?? ""),
        paidAmount: order?.ar?.amount ?? undefined,
      }),
    onSuccess: async () => {
      toast.success("Pagamento registrado (PAID).");
      await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
      await qc.invalidateQueries({ queryKey: ["pdv-orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const arStatus = String(order?.ar?.status ?? "");
  const canCreateAR = Boolean(order) && !order?.ar;
  const canReceive = Boolean(order?.ar?.id) && arStatus === "PENDING";
  const isPaid = arStatus === "PAID";

  const requestedDocType = String(order?.requestedDocType ?? "").toUpperCase();
  const lastInv = order?.lastInvoice ?? null;
  const effectiveInvoiceId = String(invoiceId || lastInv?.id || "");
  const lastInvStatus = String(lastInv?.status ?? "");
  const isNfe = requestedDocType === "NFE";
  const canConfirm = isPaid && (!isNfe || lastInvStatus === "AUTHORIZED");

  const createInvMut = useMutation({
    mutationFn: async () => {
      const docType = String(order?.requestedDocType ?? "").trim() || undefined;
      const d = await createInvoice(String(selectedId), docType);
      const id = String(d?.invoice?.id ?? "");
      if (!id) throw new Error("invoice_id_missing");
      setInvoiceId(id);
      await qc.invalidateQueries({ queryKey: ["pdv-order", { id: selectedId }] });
      return id;
    },
    onSuccess: () => toast.success("Documento fiscal criado (DRAFT)."),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const emitInvMut = useMutation({
    mutationFn: () => emitInvoice(effectiveInvoiceId),
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
                  <div className="text-xs text-muted-foreground">Recebível (AR): {order.ar ? `${order.ar.status} • ${brl(order.ar.amount)}` : "—"}</div>
                </div>

                <div className="rounded-md border">
                  <div className="border-b bg-muted px-3 py-2 text-xs font-medium">Itens</div>
                  {(order.items ?? []).map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm border-b">
                      <div>
                        <div className="font-medium">{it.product?.name ?? it.description ?? it.productId}</div>
                        <div className="text-xs text-muted-foreground">
                          {n(it.quantity ?? it.qty)} x {brl(it.unitPrice ?? it.price)}{" "}
                        </div>
                      </div>
                      <div className="tabular-nums">{brl(it.total)}</div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="font-medium">Total</div>
                    <div className="font-semibold tabular-nums">{brl(total)}</div>
                  </div>
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <div className="text-xs font-medium">Pagamento (PDV)</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => createArMut.mutate()}
                      disabled={!canCreateAR || createArMut.isPending}
                      title="Cria AccountsReceivable PENDING para este pedido"
                    >
                      {createArMut.isPending ? "Criando..." : "Criar recebível (AR)"}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => receiveMut.mutate()}
                      disabled={!canReceive || receiveMut.isPending}
                      title="Marca AccountsReceivable como PAID"
                    >
                      {receiveMut.isPending ? "Recebendo..." : "Receber pagamento"}
                    </Button>
                  </div>
                  {!order.ar ? (
                    <div className="text-xs text-muted-foreground">Crie o recebível para registrar o pagamento.</div>
                  ) : arStatus === "PENDING" ? (
                    <div className="text-xs text-muted-foreground">Recebível pendente — registre o pagamento para prosseguir.</div>
                  ) : arStatus === "PAID" ? (
                    <div className="text-xs text-muted-foreground">Pagamento OK — prossiga para o Fiscal.</div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Status AR: {arStatus}</div>
                  )}
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <div className="text-xs font-medium">Fiscal</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => createInvMut.mutate()}
                      disabled={!isPaid || createInvMut.isPending}
                      title="Cria FiscalInvoice DRAFT (somente após pagamento)"
                    >
                      {createInvMut.isPending ? "Criando..." : "Criar documento (DRAFT)"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => emitInvMut.mutate()}
                      disabled={!effectiveInvoiceId || emitInvMut.isPending}
                      title="Emite pelo provider"
                    >
                      {emitInvMut.isPending ? "Emitindo..." : "Emitir"}
                    </Button>
                    <Button asChild variant="outline" disabled={!effectiveInvoiceId}>
                      <Link href={effectiveInvoiceId ? `/fiscal/documentos/${effectiveInvoiceId}` : "#"}>Abrir documento</Link>
                    </Button>
                    <Button asChild variant="outline" disabled={!effectiveInvoiceId}>
                      <Link
                        href={
                          effectiveInvoiceId
                            ? `/fiscal/documentos/${effectiveInvoiceId}?focus=payload&from=pdv`
                            : "#"
                        }
                      >
                        Editar payload
                      </Link>
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Status: {lastInv ? `${lastInv.docType} • ${lastInv.status}` : "—"} {lastInv?.key ? `• chave ${lastInv.key}` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Regra: pagar → criar DRAFT → (editar payload na tela fiscal) → emitir → só então confirmar.
                  </div>
                </div>

                <div className="rounded-md border p-3 space-y-2">
                  <div className="text-xs font-medium">Confirmar venda</div>
                  <Button
                    onClick={() => confirmMut.mutate()}
                    disabled={!canConfirm || confirmMut.isPending}
                    title="Confirma o pedido (server ainda valida AR PAID)"
                  >
                    {confirmMut.isPending ? "Confirmando..." : "Confirmar (gera OP e reserva estoque)"}
                  </Button>
                  {isPaid && isNfe && lastInvStatus !== "AUTHORIZED" ? (
                    <div className="text-xs text-muted-foreground">
                      Pedido exige NFE — confirme somente após NFE AUTHORIZED (status atual: {lastInvStatus || "—"}).
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
