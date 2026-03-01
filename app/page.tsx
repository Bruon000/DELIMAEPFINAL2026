"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  Factory,
  Wallet,
  TrendingUp,
  Package,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

async function fetchDashboardStats() {
  const res = await fetch("/api/dashboard/stats");
  if (!res.ok) throw new Error("Falha ao carregar estatísticas");
  return res.json();
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
  });

  const cards = [
    {
      title: "Pedidos do mês",
      value: data?.ordersThisMonth ?? 0,
      icon: ShoppingCart,
      subtitle: "Pedidos confirmados ou em andamento",
      variant: "default" as const,
    },
    {
      title: "Faturamento (mês)",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(data?.revenueThisMonth ?? 0),
      icon: TrendingUp,
      subtitle: "Contas a receber pagas",
      variant: "default" as const,
    },
    {
      title: "OPs em aberto",
      value: data?.openProductionOrders ?? 0,
      icon: Factory,
      subtitle: "Na fila, em andamento ou bloqueadas",
      variant: "secondary" as const,
    },
    {
      title: "Saldo do caixa",
      value: new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(data?.cashBalance ?? 0),
      icon: Wallet,
      subtitle: "Caixa aberto atual",
      variant: "default" as const,
    },
    {
      title: "Estoque crítico",
      value: data?.criticalStockCount ?? 0,
      icon: Package,
      subtitle: "Materiais abaixo do mínimo",
      variant: (data?.criticalStockCount ?? 0) > 0 ? "destructive" : "secondary",
      iconAlt: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Visão geral</h2>
        <p className="text-muted-foreground">
          Métricas principais do ERP. Dados atualizados em tempo real.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar as estatísticas. Verifique a conexão com o banco.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const IconComponent =
            card.iconAlt && (data?.criticalStockCount ?? 0) > 0 && card.title === "Estoque crítico"
              ? card.iconAlt
              : card.icon;
          return (
            <Card key={card.title} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                {!isLoading && (
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <IconComponent className="h-4 w-4" />
                  </span>
                )}
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">{card.value}</div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {card.subtitle}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Status Pipeline – Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Fluxo: Rascunho → Aberto → Confirmado → Em produção → Pronto →
              Instalado/Entregue. Ao confirmar, o sistema gera OP e reserva
              materiais no estoque.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "DRAFT",
                "OPEN",
                "CONFIRMED",
                "IN_PRODUCTION",
                "READY",
                "DELIVERED",
                "CANCELED",
              ].map((s) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status Pipeline – Produção</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Etapas: Corte → Solda → Pintura → Montagem → Acabamento. O PWA
              do chão de fábrica atualiza status e apontamento de tempo.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["QUEUED", "IN_PROGRESS", "BLOCKED", "DONE"].map((s) => (
                <Badge key={s} variant="secondary">
                  {s}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
