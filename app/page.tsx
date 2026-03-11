"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  Factory,
  Wallet,
  TrendingUp,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  ArrowRight,
  Users,
  Banknote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function fetchDashboardStats(params?: { vendedorId?: string }) {
  const sp = new URLSearchParams();
  if (params?.vendedorId) sp.set("vendedorId", params.vendedorId);
  const res = await fetch(`/api/dashboard/stats?${sp.toString()}`);
  if (!res.ok) throw new Error("Falha ao carregar estatísticas");
  return res.json();
}

function StatCard({ title, value, icon: Icon, subtitle, loading }: {
  title: string; value: React.ReactNode; icon: any; subtitle?: string; loading?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {!loading && (
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{value}</div>}
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

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

function VendedorDashboard({ data, loading }: { data: any; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Meu painel</h2>
        <p className="text-muted-foreground">Acompanhe suas vendas e pedidos.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Pedidos do mês" value={data?.ordersMonth ?? 0} icon={ShoppingCart} subtitle="Pedidos criados por você" loading={loading} />
        <StatCard title="Pedidos hoje" value={data?.ordersToday ?? 0} icon={Clock} subtitle="Criados hoje" loading={loading} />
        <StatCard title="Aguardando caixa" value={data?.awaitingCashier ?? 0} icon={AlertTriangle} subtitle="Enviados, não confirmados" loading={loading} />
        <StatCard title="Faturamento (mês)" value={fmt.format(data?.revenueMonth ?? 0)} icon={TrendingUp} subtitle="Total recebido" loading={loading} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Últimos pedidos</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/pedidos">Ver todos <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (data?.recentOrders ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum pedido encontrado.</p>
          ) : (
            <div className="space-y-2">
              {(data?.recentOrders ?? []).map((o: any) => (
                <Link key={o.id} href={`/pedidos/${o.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted transition-colors">
                  <div>
                    <span className="font-medium">{o.client ?? "—"}</span>
                    {o.number && <span className="ml-2 text-xs text-muted-foreground">#{o.number}</span>}
                  </div>
                  <Badge variant={STATUS_VARIANT[o.status] ?? "outline"}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CaixaDashboard({ data, loading }: { data: any; loading: boolean }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Painel do Caixa</h2>
        <p className="text-muted-foreground">Resumo do dia no ponto de venda.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Fila do caixa" value={data?.queueCount ?? 0} icon={ShoppingCart} subtitle="Pedidos aguardando" loading={loading} />
        <StatCard title="Vendas confirmadas" value={data?.confirmedToday ?? 0} icon={CheckCircle2} subtitle="Hoje" loading={loading} />
        <StatCard title="Total recebido" value={fmt.format(data?.receivedToday ?? 0)} icon={Wallet} subtitle="Hoje" loading={loading} />
        <StatCard title="Notas emitidas" value={data?.invoicesToday ?? 0} icon={FileText} subtitle="Hoje" loading={loading} />
      </div>
      <div className="flex gap-3">
        <Button asChild><Link href="/financeiro/pdv">Abrir PDV</Link></Button>
      </div>
    </div>
  );
}

function AdminDashboard({
  data,
  loading,
  vendedorFilter,
  setVendedorFilter,
}: {
  data: any;
  loading: boolean;
  vendedorFilter: string;
  setVendedorFilter: (id: string) => void;
}) {
  const vendedores = data?.vendedores ?? [];
  const caixa = data?.caixaDetail;
  const selectedVendedor = vendedorFilter ? vendedores.find((v: any) => v.id === vendedorFilter) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Visão geral</h2>
          <p className="text-muted-foreground">
            {selectedVendedor ? `Métricas do vendedor: ${selectedVendedor.name}` : "Métricas principais do ERP. Filtre por vendedor para ver apenas os dados dele."}
          </p>
        </div>
        {vendedores.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Vendedor:</span>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm min-w-[180px]"
              value={vendedorFilter}
              onChange={(e) => setVendedorFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {vendedores.map((v: any) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard title="Pedidos do mês" value={data?.ordersThisMonth ?? 0} icon={ShoppingCart} subtitle={selectedVendedor ? "Deste vendedor" : "Todos os pedidos"} loading={loading} />
        <StatCard title="Faturamento (mês)" value={fmt.format(data?.revenueThisMonth ?? 0)} icon={TrendingUp} subtitle="Contas recebidas" loading={loading} />
        <StatCard title="OPs em aberto" value={data?.openProductionOrders ?? 0} icon={Factory} subtitle="Fila, em andamento ou bloqueadas" loading={loading} />
        <StatCard title="Saldo do caixa" value={fmt.format(data?.cashBalance ?? 0)} icon={Wallet} subtitle={caixa?.openSession ? `Sessão: ${caixa.openSession.userName}` : "Nenhuma sessão aberta"} loading={loading} />
        <StatCard
          title="Estoque crítico"
          value={data?.criticalStockCount ?? 0}
          icon={(data?.criticalStockCount ?? 0) > 0 ? AlertTriangle : Package}
          subtitle="Materiais abaixo do mínimo"
          loading={loading}
        />
      </div>

      {/* Caixa: quem está com sessão aberta, totais do dia */}
      {caixa && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Caixa
            </CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/financeiro/caixa">Abrir/Fechar Caixa</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {caixa.openSession ? (
              <>
                <p className="text-sm">
                  <strong>Sessão aberta:</strong> {caixa.openSession.userName}
                  <span className="text-muted-foreground ml-2">
                    (desde {new Date(caixa.openSession.openedAt).toLocaleString("pt-BR")})
                  </span>
                </p>
                <p className="text-sm"><strong>Saldo atual:</strong> {fmt.format(caixa.openSession.balance ?? 0)}</p>
                <p className="text-sm text-muted-foreground">
                  Hoje: entradas {fmt.format(caixa.todayIn)} · saídas {fmt.format(caixa.todayOut)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma sessão de caixa aberta. Abra em Financeiro → Abrir/Fechar Caixa.</p>
            )}
            <p className="text-xs text-muted-foreground">Sessões fechadas (histórico): {caixa.closedSessionsCount}</p>
          </CardContent>
        </Card>
      )}

      {/* Resumo por vendedor */}
      {vendedores.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Por vendedor
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/vendedores">Ver detalhes <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Vendedor</th>
                    <th className="text-right p-2">Pedidos (mês)</th>
                    <th className="text-right p-2">Pedidos hoje</th>
                    <th className="text-right p-2">Faturamento (mês)</th>
                  </tr>
                </thead>
                <tbody>
                  {vendedores.map((v: any) => (
                    <tr key={v.id} className="border-t">
                      <td className="p-2 font-medium">
                        <Link href={`/admin/vendedores?vendedorId=${v.id}`} className="hover:underline">{v.name}</Link>
                      </td>
                      <td className="p-2 text-right tabular-nums">{v.ordersMonth ?? 0}</td>
                      <td className="p-2 text-right tabular-nums">{v.ordersToday ?? 0}</td>
                      <td className="p-2 text-right tabular-nums">{fmt.format(v.revenueMonth ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Status Pipeline – Pedidos</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Fluxo: Rascunho &rarr; Aberto &rarr; Confirmado &rarr; Em produção &rarr; Pronto &rarr; Entregue.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["DRAFT","OPEN","CONFIRMED","IN_PRODUCTION","READY","DELIVERED","CANCELED"].map((s) => (
                <Badge key={s} variant="outline">{s}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Status Pipeline – Produção</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Etapas: Corte &rarr; Solda &rarr; Pintura &rarr; Montagem &rarr; Acabamento.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["QUEUED","IN_PROGRESS","BLOCKED","DONE"].map((s) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [vendedorFilter, setVendedorFilter] = React.useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats", vendedorFilter],
    queryFn: () => fetchDashboardStats({ vendedorId: vendedorFilter || undefined }),
  });

  const role = data?.role ?? "";

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar as estatísticas. Verifique a conexão com o banco.
        </div>
      )}

      {role === "VENDEDOR" && <VendedorDashboard data={data} loading={isLoading} />}
      {role === "CAIXA" && <CaixaDashboard data={data} loading={isLoading} />}
      {(role === "ADMIN" || role === "" || !role) && (
        <AdminDashboard
          data={data}
          loading={isLoading}
          vendedorFilter={vendedorFilter}
          setVendedorFilter={setVendedorFilter}
        />
      )}
    </div>
  );
}
