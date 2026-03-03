"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/erp/page-header";
import { FiltersBar as FiltersShell } from "@/components/erp/filters-shell";
import { DataTable, type Column } from "@/components/erp/data-table";
import { PurchaseOrderStatusBadge } from "@/components/erp/status-badge";

async function fetchSuppliers() {
  const res = await fetch("/api/suppliers");
  if (!res.ok) throw new Error("Erro ao carregar fornecedores");
  return res.json();
}

async function fetchPOs() {
  const res = await fetch("/api/purchase-orders");
  if (!res.ok) throw new Error("Erro ao carregar compras");
  return res.json();
}

async function createPO(payload: any) {
  const res = await fetch("/api/purchase-orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
  return data;
}

async function importNfeXml(xml: string) {
  const res = await fetch("/api/fiscal/nfe/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xml }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      res.status === 401
        ? "Sessão expirada, faça login novamente."
        : (data?.message ?? data?.error ?? "Erro ao importar NF-e");
    throw { message, error: data?.error, status: res.status, data };
  }
  return data;
}

function money(n: any) {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ComprasPedidosPage() {
  const qc = useQueryClient();

  const [supplierId, setSupplierId] = React.useState("");
  const [isImportingNfe, setIsImportingNfe] = React.useState(false);
  const nfeFileRef = React.useRef<HTMLInputElement | null>(null);
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"ALL" | "DRAFT" | "SENT" | "RECEIVED" | "CANCELED">("ALL");

  const { data: supData, isLoading: suppliersLoading } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data, isLoading } = useQuery({ queryKey: ["purchase-orders"], queryFn: fetchPOs });

  const mut = useMutation({
    mutationFn: createPO,
    onSuccess: async (d: { id?: string }) => {
      toast.success("Pedido de compra criado!");
      setSupplierId("");
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      if (d?.id) window.location.href = `/compras/pedidos/${d.id}`;
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao criar pedido"),
  });

  function onPickNfeClick() {
    nfeFileRef.current?.click();
  }

  async function handlePickNfe(file: File | null) {
    if (!file) return;
    const name = (file.name || "").toLowerCase();
    if (!name.endsWith(".xml")) {
      toast.error("Selecione um arquivo .xml");
      return;
    }
    if (file.size < 50) {
      toast.error("Arquivo muito pequeno. Use um XML de NF-e válido.");
      return;
    }
    setIsImportingNfe(true);
    try {
      const xml = await file.text();
      const r = await importNfeXml(xml);
      await qc.invalidateQueries({ queryKey: ["purchase-orders"] });

      if (r?.alreadyImported) {
        toast.success("NF-e já importada. Abrindo pedido existente...");
      } else {
        const count = r?.itemsCount ?? "?";
        toast.success(`NF-e importada: ${count} itens. Abrindo pedido...`);
      }

      if (r?.purchaseOrderId) {
        window.location.href = `/compras/pedidos/${r.purchaseOrderId}`;
      }
    } catch (err: unknown) {
      const e = err as { message?: string; error?: string; data?: { message?: string } };
      const msg = e?.data?.message ?? e?.message ?? "Erro ao importar NF-e";
      if (e?.error === "unit_required") {
        toast.warning(msg, {
          action: {
            label: "Ir para Unidades",
            onClick: () => { window.location.href = "/cadastros/unidades"; },
          },
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setIsImportingNfe(false);
      if (nfeFileRef.current) nfeFileRef.current.value = "";
    }
  }

const suppliers = supData?.suppliers ?? [];
  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.purchaseOrders ?? []).filter((po: any) => {
      const s = String(po.status ?? "").toUpperCase();
      if (status !== "ALL" && s !== status) return false;

      if (!needle) return true;
      const name = String(po?.supplier?.name ?? "").toLowerCase();
      const id = String(po?.id ?? "").toLowerCase();
      return name.includes(needle) || id.includes(needle);
    });
  }, [data?.purchaseOrders, q, status]);

  const columns: Column<any>[] = [
    {
      key: "supplier",
      header: "Fornecedor",
      cell: (po) => (
        <div className="min-w-[260px]">
          <div className="font-medium">{po.supplier?.name ?? "Sem fornecedor"}</div>
          <div className="text-xs text-muted-foreground">ID: {po.id}</div>
        </div>
      ),
    },
    {
      key: "items",
      header: "Itens",
      headerClassName: "w-[90px]",
      className: "text-right tabular-nums",
      cell: (po) => Number(po.itemsCount ?? 0),
    },
    {
      key: "total",
      header: "Total",
      headerClassName: "w-[140px]",
      className: "text-right tabular-nums",
      cell: (po) => money(po.total ?? 0),
    },
    {
      key: "status",
      header: "Status",
      headerClassName: "w-[140px]",
      cell: (po) => <PurchaseOrderStatusBadge status={po.status} />,
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[120px]",
      className: "text-right",
      cell: (po) => (
        <Link href={`/compras/pedidos/${po.id}`} onClick={(e) => e.stopPropagation()}>
          <Button variant="secondary" size="sm">Abrir</Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Compras"
        subtitle="Pedidos de compra com status, totais e ações. Padrão visual ERP (tabela + filtros + badge)."
        actions={
          <>
            <Button
              variant="outline"
              type="button"
              disabled={isImportingNfe}
              onClick={onPickNfeClick}
            >
              {isImportingNfe ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Importando...
                </>
              ) : (
                "Importar NF-e (XML)"
              )}
            </Button>
            <Link href="/cadastros/fornecedores">
              <Button variant="secondary">Fornecedores</Button>
            </Link>
          </>
        }
      />

      <input
        ref={nfeFileRef}
        type="file"
        accept=".xml,application/xml,text/xml"
        className="hidden"
        aria-hidden
        onChange={(e) => handlePickNfe(e.target.files?.[0] ?? null)}
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo pedido de compra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_220px] md:items-center">
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              disabled={suppliersLoading}
            >
              <option value="">{suppliersLoading ? "Carregando fornecedores..." : "Selecione um fornecedor…"}</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <div className="flex flex-col gap-2 md:flex-row md:justify-end">
              <Button
                disabled={!supplierId || mut.isPending || isImportingNfe}
                onClick={() => mut.mutate({ supplierId })}
                className="w-full md:w-auto"
              >
                {mut.isPending ? "Criando..." : "Criar pedido"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <FiltersShell
        search={q}
        onSearchChange={setQ}
        onClearAll={() => {
          setQ("");
          setStatus("ALL");
        }}
        leftSlot={
          <>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="ALL">Todos os status</option>
              <option value="DRAFT">Rascunho</option>
              <option value="SENT">Enviado</option>
              <option value="RECEIVED">Recebido</option>
              <option value="CANCELED">Cancelado</option>
            </select>

            <div className="text-xs text-muted-foreground ml-1">
              Mostrando {filtered.length} de {(data?.purchaseOrders ?? []).length}
            </div>
          </>
        }
        rightSlot={
          <Button
            variant="secondary"
            onClick={() => { setQ(""); setStatus("ALL"); }}
          >
            Limpar filtros
          </Button>
        }
      />

      <DataTable
        rows={filtered}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle={isLoading ? "Carregando..." : "Sem pedidos de compra"}
        emptyHint={isLoading ? "Buscando dados…" : "Crie um pedido acima ou ajuste os filtros."}
        onRowClick={(po) => { window.location.href = `/compras/pedidos/${po.id}`; }}
      />
    </div>
  );
}



