"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Search, Plus, ChevronRight, ChevronDown, Loader2, Factory, Package, MapPin } from "lucide-react";

async function fetchOrders(params?: { vendedorId?: string }) {
  const sp = new URLSearchParams();
  if (params?.vendedorId) sp.set("vendedorId", params.vendedorId);
  const res = await fetch(`/api/orders?${sp.toString()}`);
  if (!res.ok) throw new Error("Erro ao carregar pedidos");
  return res.json();
}

async function patchOrderStatus(orderId: string, status: string) {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao atualizar");
  return data;
}

type OrderItem = { id: string; productName: string | null; productCode: string | null; quantity: number; unitPrice: number; total: number };
type TimelineStep = { label: string; date: string | null };

type Order = {
  id: string;
  number: string | null;
  status: string;
  client: { id: string; name: string } | null;
  createdAt: string;
  sentToCashierAt: string | null;
  confirmedAt: string | null;
  requestedDocType: string | null;
  lastInvoiceStatus: string | null;
  lastInvoiceDocType: string | null;
  createdBy: { id: string; name: string } | null;
  total: number;
  itemsCount: number;
  notes?: string | null;
  deliveryAddress?: string | null;
  items?: OrderItem[];
  timeline?: TimelineStep[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  OPEN: "Enviado ao Caixa",
  CONFIRMED: "Confirmado",
  IN_PRODUCTION: "Em produção",
  READY: "Pronto",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "secondary",
  OPEN: "default",
  CONFIRMED: "default",
  IN_PRODUCTION: "outline",
  READY: "outline",
  DELIVERED: "outline",
  CANCELED: "destructive",
};

const INVOICE_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING: "Emitindo",
  AUTHORIZED: "Autorizada",
  REJECTED: "Rejeitada",
  CANCELLED: "Cancelada",
  INUTILIZED: "Inutilizada",
};

const INVOICE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  PENDING: "secondary",
  AUTHORIZED: "default",
  REJECTED: "destructive",
  CANCELLED: "destructive",
  INUTILIZED: "secondary",
};

const STATUS_FILTERS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Rascunho" },
  { value: "OPEN", label: "Enviado ao Caixa" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "IN_PRODUCTION", label: "Em produção" },
  { value: "READY", label: "Pronto" },
  { value: "DELIVERED", label: "Entregue" },
  { value: "CANCELED", label: "Cancelado" },
];

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function fmtDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function PedidosContent() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const vendedorId = searchParams.get("vendedorId") ?? "";
  const { data: session } = useSession();
  const role = String((session as any)?.user?.role ?? "");

  const { data, isLoading, error } = useQuery({
    queryKey: ["orders", vendedorId],
    queryFn: () => fetchOrders({ vendedorId: vendedorId || undefined }),
  });
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const statusMut = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) => patchOrderStatus(orderId, status),
    onSuccess: async () => {
      toast.success("Status atualizado.");
      await qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const orders: Order[] = data?.orders ?? [];

  const filtered = React.useMemo(() => {
    let list = orders;
    if (statusFilter) list = list.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          (o.client?.name ?? "").toLowerCase().includes(q) ||
          (o.number ?? "").toLowerCase().includes(q) ||
          (o.createdBy?.name ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [orders, statusFilter, search]);

  const canChangeStatus = role === "ADMIN" || role === "PRODUCAO";

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Pedidos</h1>
          {vendedorId && role === "ADMIN" && (
            <Link href="/pedidos" className="text-sm text-muted-foreground hover:underline">(limpar filtro vendedor)</Link>
          )}
        </div>
        <Button asChild>
          <Link href="/comercial/venda"><Plus className="mr-1 h-4 w-4" /> Nova venda</Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, número ou vendedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={statusFilter === f.value ? "default" : "outline"}
              onClick={() => setStatusFilter(f.value)}
              className="text-xs"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {error && <p className="text-red-600">Erro ao carregar pedidos.</p>}

      {!isLoading && !error && (
        <Card className="overflow-hidden">
          <div className="w-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="border-b">
                  <th className="w-10 px-2 py-3" />
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-[60px]">#</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Documento</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fiscal</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                      Nenhum pedido encontrado. {search || statusFilter ? "Tente alterar os filtros." : "Crie seu primeiro pedido."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => {
                    const isExpanded = expandedId === o.id;
                    return (
                      <React.Fragment key={o.id}>
                        <tr
                          className={`border-b last:border-b-0 transition-colors hover:bg-muted/40 ${isExpanded ? "bg-muted/30" : ""}`}
                        >
                          <td className="px-2 py-2 align-middle">
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-muted"
                              onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : o.id); }}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 align-middle font-mono text-xs">{o.number ?? "—"}</td>
                          <td className="px-4 py-3 align-middle font-medium">{o.client?.name ?? "Sem cliente"}</td>
                          <td className="px-4 py-3 align-middle">
                            <Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {(() => {
                              const doc = o.requestedDocType ?? o.lastInvoiceDocType;
                              if (!doc) return <span className="text-muted-foreground text-xs">—</span>;
                              return <Badge variant="outline" className="text-xs">{doc === "NFCE" ? "NFC-e" : doc === "NFE" ? "NF-e" : doc}</Badge>;
                            })()}
                          </td>
                          <td className="px-4 py-3 align-middle">
                            {o.lastInvoiceStatus ? (
                              <Badge variant={INVOICE_VARIANT[o.lastInvoiceStatus] ?? "outline"} className="text-xs">
                                {INVOICE_LABEL[o.lastInvoiceStatus] ?? o.lastInvoiceStatus}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 align-middle text-right tabular-nums">{fmt.format(o.total)}</td>
                          <td className="px-4 py-3 align-middle text-xs text-muted-foreground">{fmtDate(o.createdAt)}</td>
                          <td className="px-4 py-3 align-middle text-xs">{o.createdBy?.name ?? "—"}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/20 border-b last:border-b-0">
                            <td colSpan={9} className="px-4 py-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                    <Package className="h-3.5 w-3.5" /> Itens do pedido
                                  </h4>
                                  {(o.items?.length ?? 0) > 0 ? (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b">
                                          <th className="text-left py-1">Produto</th>
                                          <th className="text-right py-1">Qtd</th>
                                          <th className="text-right py-1">Unit.</th>
                                          <th className="text-right py-1">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(o.items ?? []).map((it) => (
                                          <tr key={it.id} className="border-b border-dashed">
                                            <td className="py-1">{it.productName ?? it.productCode ?? "—"}</td>
                                            <td className="text-right tabular-nums py-1">{it.quantity}</td>
                                            <td className="text-right tabular-nums py-1">{fmt.format(it.unitPrice)}</td>
                                            <td className="text-right tabular-nums py-1 font-medium">{fmt.format(it.total)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">Nenhum item.</p>
                                  )}
                                </div>
                                <div>
                                  {o.deliveryAddress && (
                                    <>
                                      <h4 className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5" /> Endereço de entrega
                                      </h4>
                                      <p className="text-xs mb-3">{o.deliveryAddress}</p>
                                    </>
                                  )}
                                  {o.notes && (
                                    <>
                                      <h4 className="text-xs font-semibold text-muted-foreground mb-1">Observações</h4>
                                      <p className="text-xs mb-3">{o.notes}</p>
                                    </>
                                  )}
                                  {(o.timeline?.length ?? 0) > 0 && (
                                    <>
                                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">Timeline</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {(o.timeline ?? []).map((step, i) => (
                                          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-background border px-2 py-1 text-xs">
                                            {step.label}
                                            {step.date && <span className="text-muted-foreground">{fmtDateTime(step.date)}</span>}
                                          </span>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={`/pedidos/${o.id}`}>Abrir pedido</Link>
                                </Button>
                                {canChangeStatus && o.status === "CONFIRMED" && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={statusMut.isPending}
                                    onClick={() => statusMut.mutate({ orderId: o.id, status: "IN_PRODUCTION" })}
                                  >
                                    {statusMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />}
                                    {statusMut.isPending ? "..." : "Enviar para produção"}
                                  </Button>
                                )}
                                {canChangeStatus && (o.status === "IN_PRODUCTION" || o.status === "READY") && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={statusMut.isPending}
                                    onClick={() => statusMut.mutate({ orderId: o.id, status: o.status === "READY" ? "DELIVERED" : "READY" })}
                                  >
                                    {statusMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                                    {statusMut.isPending ? "..." : o.status === "READY" ? "Marcar como entregue" : "Marcar como pronto"}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function PedidosPage() {
  return (
    <React.Suspense fallback={<div className="p-6 flex items-center justify-center">Carregando...</div>}>
      <PedidosContent />
    </React.Suspense>
  );
}
