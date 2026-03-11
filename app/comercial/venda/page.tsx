"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  User, ShoppingCart, FileText, Search, Loader2, ArrowRight,
  ClipboardList, AlertTriangle, Users, Package, Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Client = { id: string; name: string; document?: string | null };

function onlyDigits(v: string | null | undefined) {
  return String(v ?? "").replace(/\D/g, "");
}

async function fetchClients() {
  const res = await fetch("/api/clients");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar clientes");
  return (data?.clients ?? []) as Client[];
}

async function fetchWalkinClient() {
  const res = await fetch("/api/clients/walkin");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar cliente balcão");
  return data?.client as { id: string; name: string };
}

async function createOrder(payload: any) {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao criar pedido");
  return data as { id: string };
}

async function createQuote(payload: any) {
  const res = await fetch("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao criar orçamento");
  return data as { id: string };
}

async function fetchVendaPanel() {
  const res = await fetch("/api/commercial/venda-panel");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar painel");
  return data as {
    drafts: { id: string; number: string | null; status: string; createdAt: string; client: { id: string; name: string } | null }[];
    openOrders: { id: string; number: string | null; status: string; sentToCashierAt: string | null; client: { id: string; name: string } | null }[];
    carteira: { id: string; orderId: string; dueDate: string; amount: number; orderNumber: string | null; client: { id: string; name: string } | null }[];
    carteiraTotal: number;
    frequentClients: { id: string; name: string; orderCount: number }[];
    stockAlerts: { materialId: string; materialName: string; minStock: number; available: number }[];
  };
}

function fmtMoney(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ComercialVendaPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const qClients = useQuery({ queryKey: ["clients"], queryFn: fetchClients });
  const qWalkin = useQuery({ queryKey: ["walkin-client"], queryFn: fetchWalkinClient });
  const qPanel = useQuery({ queryKey: ["venda-panel"], queryFn: fetchVendaPanel });
  const panel = qPanel.data;

  const [walkIn, setWalkIn] = React.useState(false);
  const [clientId, setClientId] = React.useState("");
  const [qClient, setQClient] = React.useState("");

  const clients = React.useMemo(
    () => (Array.isArray(qClients.data) ? qClients.data : []),
    [qClients.data],
  );

  const filteredClients = React.useMemo(() => {
    const needle = qClient.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) => {
      const name = String(c?.name ?? "").toLowerCase();
      const doc = String(c?.document ?? "").toLowerCase();
      return name.includes(needle) || doc.includes(needle);
    });
  }, [clients, qClient]);

  const selectedClient = React.useMemo(() => clients.find((x) => x.id === clientId) ?? null, [clients, clientId]);

  const resolvedClientId = walkIn ? String(qWalkin.data?.id ?? "") : clientId;
  const hasClient = Boolean(resolvedClientId);

  const docHint = React.useMemo(() => {
    if (walkIn) return "NFC-e";
    if (!selectedClient?.document) return "—";
    return onlyDigits(selectedClient.document).length === 14 ? "NF-e" : "NFC-e";
  }, [walkIn, selectedClient]);

  const createOrderMut = useMutation({
    mutationFn: async () => {
      if (!hasClient) throw new Error("Selecione um cliente ou ative Balcão.");
      return createOrder({ clientId: resolvedClientId, walkIn });
    },
    onSuccess: (d) => {
      toast.success("Pedido criado!");
      qc.invalidateQueries({ queryKey: ["venda-panel"] });
      router.push(`/pedidos/${d.id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar pedido"),
  });

  const createQuoteMut = useMutation({
    mutationFn: async () => {
      if (!hasClient) throw new Error("Selecione um cliente ou ative Balcão.");
      return createQuote({ clientId: resolvedClientId });
    },
    onSuccess: (d) => {
      toast.success("Orçamento criado!");
      qc.invalidateQueries({ queryKey: ["venda-panel"] });
      router.push(`/orcamentos/${d.id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar orçamento"),
  });

  const isPending = createOrderMut.isPending || createQuoteMut.isPending;

  return (
    <div className="p-6 space-y-6 flex flex-col lg:flex-row lg:gap-6">
      <div className="flex-1 min-w-0 space-y-6">
      <PageHeader
        title="Nova Venda"
        subtitle="Selecione o cliente e escolha como prosseguir."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/clientes">Clientes</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/pedidos">Pedidos</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/comercial/orcamentos">Orçamentos</Link>
            </Button>
          </div>
        }
      />

      <div className="mx-auto max-w-xl space-y-4">
        {/* Client selection */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="text-sm font-semibold">Cliente</div>

            <button
              type="button"
              onClick={() => { setWalkIn(!walkIn); setClientId(""); }}
              className={`w-full rounded-xl border p-3 text-left text-sm transition ${
                walkIn
                  ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                  : "bg-background hover:bg-muted/40"
              }`}
            >
              <div className="font-medium">{walkIn ? "Balcão ativo" : "Venda de balcão (sem cadastro)"}</div>
              <div className="text-xs text-muted-foreground">
                {walkIn ? "NFC-e · Clique para desativar e escolher cliente" : "Ative para NFC-e sem CPF/CNPJ"}
              </div>
            </button>

            {!walkIn && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9 h-9" placeholder="Buscar cliente (nome/doc)..." value={qClient} onChange={(e) => setQClient(e.target.value)} />
                </div>
                <select
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={qClients.isLoading}
                >
                  <option value="">{qClients.isLoading ? "Carregando..." : "Selecione um cliente…"}</option>
                  {filteredClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} {c.document ? `· ${c.document}` : ""}</option>
                  ))}
                </select>
              </>
            )}

            {/* Selected client preview */}
            {hasClient && (
              <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {walkIn ? (qWalkin.data?.name ?? "CONSUMIDOR FINAL") : (selectedClient?.name ?? "—")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {walkIn ? "Sem CPF/CNPJ · Balcão" : (selectedClient?.document ?? "Sem documento")}
                  </div>
                </div>
                <Badge variant="secondary" className="ml-auto shrink-0">{docHint}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Destination cards */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Create order */}
          <button
            type="button"
            disabled={!hasClient || isPending}
            onClick={() => createOrderMut.mutate()}
            className="group rounded-2xl border bg-background p-5 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/[0.03] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ShoppingCart className="h-5 w-5 text-primary" />
            </div>
            <div className="text-sm font-semibold">Criar Pedido</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Cria um pedido rascunho. Adicione itens, configure pagamento e envie ao Caixa.
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">
              {createOrderMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
              {createOrderMut.isPending ? "Criando..." : "Ir para o pedido"}
            </div>
          </button>

          {/* Create quote */}
          <button
            type="button"
            disabled={!hasClient || isPending}
            onClick={() => createQuoteMut.mutate()}
            className="group rounded-2xl border bg-background p-5 text-left shadow-sm transition hover:border-blue-400/40 hover:bg-blue-50/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-sm font-semibold">Criar Orçamento</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Cria um orçamento com validade de 15 dias. Pode ser convertido em pedido depois.
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition group-hover:opacity-100">
              {createQuoteMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
              {createQuoteMut.isPending ? "Criando..." : "Ir para o orçamento"}
            </div>
          </button>
        </div>

        {!hasClient && (
          <div className="text-center text-xs text-muted-foreground">
            Selecione um cliente ou ative o modo Balcão para prosseguir.
          </div>
        )}
      </div>
      </div>

      {/* Painel lateral */}
      <aside className="w-full lg:w-80 shrink-0 space-y-3">
        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Resumo
        </div>

        <Collapsible defaultOpen={true} className="rounded-lg border bg-card">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 rounded-t-lg">
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Rascunhos
            </span>
            <Badge variant="secondary">{panel?.drafts?.length ?? 0}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="border-t px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
              {qPanel.isLoading ? (
                <li className="text-xs text-muted-foreground">Carregando...</li>
              ) : (panel?.drafts?.length ?? 0) === 0 ? (
                <li className="text-xs text-muted-foreground">Nenhum rascunho</li>
              ) : (
                panel?.drafts?.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/pedidos/${o.id}`}
                      className="text-xs text-primary hover:underline block truncate"
                    >
                      {o.number ?? o.id.slice(-8)} · {o.client?.name ?? "—"}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen={true} className="rounded-lg border bg-card">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 rounded-t-lg">
            <span className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Pedidos abertos
            </span>
            <Badge variant="secondary">{panel?.openOrders?.length ?? 0}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="border-t px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
              {qPanel.isLoading ? (
                <li className="text-xs text-muted-foreground">Carregando...</li>
              ) : (panel?.openOrders?.length ?? 0) === 0 ? (
                <li className="text-xs text-muted-foreground">Nenhum pedido aberto</li>
              ) : (
                panel?.openOrders?.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/pedidos/${o.id}`}
                      className="text-xs text-primary hover:underline block truncate"
                    >
                      {o.number ?? o.id.slice(-8)} · {o.client?.name ?? "—"}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen={true} className="rounded-lg border bg-card">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 rounded-t-lg">
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Carteira
            </span>
            <Badge variant="secondary">{panel?.carteira?.length ?? 0}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t px-3 py-2">
              <p className="text-[11px] text-muted-foreground mb-2">
                Vendas a receber (à prazo). Para vender na carteira: crie o pedido → Enviar ao caixa → no PDV use &quot;Criar recebível&quot; (defina o vencimento).
              </p>
              <p className="text-[11px] text-muted-foreground mb-2">
                <strong>Onde fica:</strong> aqui no painel (resumo) e em <Link href="/financeiro/recebimentos" className="underline text-foreground">Financeiro → Recebimentos</Link>. Ao receber o pagamento, use Recebimentos ou o PDV.
              </p>
              {(panel?.carteiraTotal ?? 0) > 0 && (
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Total a receber: {fmtMoney(panel?.carteiraTotal ?? 0)}
                </div>
              )}
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {qPanel.isLoading ? (
                  <li className="text-xs text-muted-foreground">Carregando...</li>
                ) : (panel?.carteira?.length ?? 0) === 0 ? (
                  <li className="text-xs text-muted-foreground">Nada a receber</li>
                ) : (
                  panel?.carteira?.map((ar) => (
                    <li key={ar.id} className="flex flex-col gap-0.5">
                      <Link
                        href={`/pedidos/${ar.orderId}`}
                        className="text-xs text-primary hover:underline truncate"
                      >
                        {ar.client?.name ?? "—"} · {ar.orderNumber ?? ar.orderId.slice(-8)}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {fmtMoney(ar.amount)} · venc. {fmtDate(ar.dueDate)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
              {(panel?.carteira?.length ?? 0) > 0 && (
                <Link
                  href="/financeiro/recebimentos"
                  className="inline-block mt-2 text-xs font-medium text-primary hover:underline"
                >
                  Ver todas →
                </Link>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen={true} className="rounded-lg border bg-card">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 rounded-t-lg">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Clientes frequentes
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="border-t px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
              {qPanel.isLoading ? (
                <li className="text-xs text-muted-foreground">Carregando...</li>
              ) : (panel?.frequentClients?.length ?? 0) === 0 ? (
                <li className="text-xs text-muted-foreground">Nenhum dado</li>
              ) : (
                panel?.frequentClients?.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setClientId(c.id)}
                      className="text-xs text-left truncate flex-1 hover:text-primary hover:underline"
                    >
                      {c.name}
                    </button>
                    <Badge variant="outline" className="text-[10px] shrink-0">{c.orderCount}</Badge>
                  </li>
                ))
              )}
            </ul>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen={true} className="rounded-lg border bg-card">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 rounded-t-lg">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Estoque crítico
            </span>
            <Badge variant={(panel?.stockAlerts?.length ?? 0) > 0 ? "destructive" : "secondary"}>
              {panel?.stockAlerts?.length ?? 0}
            </Badge>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="border-t px-3 py-2 space-y-1 max-h-40 overflow-y-auto">
              {qPanel.isLoading ? (
                <li className="text-xs text-muted-foreground">Carregando...</li>
              ) : (panel?.stockAlerts?.length ?? 0) === 0 ? (
                <li className="text-xs text-muted-foreground">Nenhum material abaixo do mínimo</li>
              ) : (
                panel?.stockAlerts?.map((a) => (
                  <li key={a.materialId}>
                    <Link
                      href="/estoque/critico"
                      className="text-xs text-amber-600 hover:underline block truncate"
                    >
                      <Package className="h-3 w-3 inline mr-1" />
                      {a.materialName} (disp. {a.available}, mín. {a.minStock})
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </aside>
    </div>
  );
}
