"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/page-header";
import { Users, ShoppingCart, Receipt, ArrowLeft } from "lucide-react";

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function fetchDashboardStats() {
  const res = await fetch("/api/dashboard/stats");
  if (!res.ok) throw new Error("Falha ao carregar dados");
  return res.json();
}

type Vendedor = { id: string; name: string; ordersMonth?: number; ordersToday?: number; revenueMonth?: number };

function AdminVendedoresContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("vendedorId") ?? "";
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
  });
  const vendedores: Vendedor[] = data?.vendedores ?? [];

  const backButton = (
    <Button variant="outline" size="sm" asChild>
      <Link href="/"><ArrowLeft className="mr-1 h-4 w-4" />Voltar ao Dashboard</Link>
    </Button>
  );

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Vendedores"
        subtitle="Desempenho por vendedor: pedidos e faturamento do mês. Use os links para ver pedidos ou recebimentos de cada um."
        actions={backButton}
      />
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Não foi possível carregar os dados. Verifique a conexão.
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Resumo por vendedor
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Métricas do mês atual. Clique em Pedidos ou Recebimentos para filtrar por vendedor.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && vendedores.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum vendedor com pedidos. Cadastre usuários com perfil VENDEDOR em Admin → Usuários.</p>
          )}
          {!isLoading && vendedores.length > 0 && (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Vendedor</th>
                    <th className="text-right p-3">Pedidos (mês)</th>
                    <th className="text-right p-3">Pedidos (hoje)</th>
                    <th className="text-right p-3">Faturamento (mês)</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vendedores.map((v) => (
                    <tr key={v.id} className={"border-t " + (highlightId === v.id ? "bg-primary/5" : "")}>
                      <td className="p-3 font-medium">{v.name}</td>
                      <td className="p-3 text-right tabular-nums">{v.ordersMonth ?? 0}</td>
                      <td className="p-3 text-right tabular-nums">{v.ordersToday ?? 0}</td>
                      <td className="p-3 text-right tabular-nums">{fmt.format(v.revenueMonth ?? 0)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={"/pedidos?vendedorId=" + encodeURIComponent(v.id)}>
                              <ShoppingCart className="mr-1 h-3.5 w-3.5" />Pedidos
                            </Link>
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={"/financeiro/recebimentos?vendedorId=" + encodeURIComponent(v.id)}>
                              <Receipt className="mr-1 h-3.5 w-3.5" />Recebimentos
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminVendedoresPage() {
  return (
    <React.Suspense fallback={<div className="p-6 flex items-center justify-center">Carregando...</div>}>
      <AdminVendedoresContent />
    </React.Suspense>
  );
}
