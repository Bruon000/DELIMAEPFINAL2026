"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchClients() {
  const res = await fetch("/api/clients");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar clientes");
  return data as { clients: any[] };
}

async function createOrder(payload: { clientId: string }) {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao criar pedido");
  return data as { id: string };
}

async function createQuote(payload: { clientId: string }) {
  const res = await fetch("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao criar orçamento");
  return data as { ok: boolean; id: string };
}

export default function ComercialVendaPage() {
  const router = useRouter();
  const qClients = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const [clientId, setClientId] = React.useState("");
  const [q, setQ] = React.useState("");

  const orderMut = useMutation({
    mutationFn: () => createOrder({ clientId }),
    onSuccess: (d) => {
      toast.success("Pedido criado. Continue a venda no pedido.");
      router.push(`/pedidos/${(d as any).id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar pedido"),
  });

  const quoteMut = useMutation({
    mutationFn: () => createQuote({ clientId }),
    onSuccess: (d) => {
      toast.success("Orçamento criado. Você pode reativar depois pelo orçamento.");
      router.push(`/orcamentos/${(d as any).id}`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar orçamento"),
  });

  const clients = React.useMemo(() => {
    return qClients.data?.clients ?? [];
  }, [qClients.data?.clients]);

  const filteredClients = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return (clients ?? []).filter((c: any) => {
      const name = String(c?.name ?? "").toLowerCase();
      const doc = String(c?.document ?? "").toLowerCase();
      const id = String(c?.id ?? "").toLowerCase();
      return name.includes(needle) || doc.includes(needle) || id.includes(needle);
    });
  }, [clients, q]);

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Iniciar Venda"
        subtitle="Fluxo rápido: escolher cliente → criar Pedido ou Orçamento."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/clientes">Clientes</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/estoque/materiais">Estoque (Materiais)</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>1) Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[1fr_180px] md:items-center">
            <Input
              placeholder="Buscar cliente (nome / doc / id)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button asChild variant="outline" className="w-full md:w-auto">
              <Link href="/clientes">Cadastrar cliente</Link>
            </Button>
          </div>

          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={qClients.isLoading}
          >
            <option value="">
              {qClients.isLoading ? "Carregando clientes..." : "Selecione um cliente…"}
            </option>
            {filteredClients.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!clientId || orderMut.isPending}
              onClick={() => orderMut.mutate()}
            >
              {orderMut.isPending ? "Criando..." : "2) Criar Pedido (Venda)"}
            </Button>

            <Button
              variant="secondary"
              disabled={!clientId || quoteMut.isPending}
              onClick={() => quoteMut.mutate()}
            >
              {quoteMut.isPending ? "Criando..." : "2) Criar Orçamento (15 dias)"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Dica: orçamento expira em 15 dias e depois só o Admin desbloqueia.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Acesso rápido</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/comercial/pedidos">Pedidos</Link></Button>
          <Button asChild variant="outline"><Link href="/comercial/orcamentos">Orçamentos</Link></Button>
          <Button asChild variant="outline"><Link href="/clientes">Cadastrar/Editar clientes</Link></Button>
          <Button asChild variant="outline"><Link href="/estoque/critico">Estoque crítico</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
