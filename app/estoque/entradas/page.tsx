"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/erp/page-header";

async function fetchMaterials() {
  const res = await fetch("/api/materials");
  if (!res.ok) throw new Error("Erro ao carregar materiais");
  return res.json();
}

async function receive(payload: any) {
  const res = await fetch("/api/stock/receive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao lançar entrada");
  return data;
}

export default function EntradasPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });

  const [materialId, setMaterialId] = React.useState("");
  const [quantity, setQuantity] = React.useState("1");
  const [reference, setReference] = React.useState("");
  const [note, setNote] = React.useState("");

  const mut = useMutation({
    mutationFn: receive,
    onSuccess: async () => {
      toast.success("Entrada registrada (RECEIVED).");
      setMaterialId("");
      setQuantity("1");
      setReference("");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["materials"] });
      await qc.invalidateQueries({ queryKey: ["stock-ledger"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar entrada"),
  });

  const materials = data?.materials ?? [];
  const canSubmit = materialId && Number(quantity) > 0 && !mut.isPending;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Entrada de Estoque"
        subtitle="Lançamento manual de entrada (RECEIVED) com referência e observação."
        actions={
          <Button variant="secondary" onClick={() => qc.invalidateQueries({ queryKey: ["materials"] })}>
            Recarregar materiais
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Lançar entrada (RECEIVED)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-1">
            <Label>Material</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              disabled={isLoading}
            >
              <option value="">
                {isLoading ? "Carregando materiais..." : "Selecione um material…"}
              </option>
              {materials.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.code ? `${m.code} - ` : ""}{m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <Label>Quantidade</Label>
              <Input
                type="number"
                step="0.0001"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <div className="grid gap-1">
              <Label>Referência (opcional)</Label>
              <Input
                placeholder="NF, compra, inventário, OS, OP..."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1">
            <Label>Observação (opcional)</Label>
            <Input
              placeholder="Ex.: conferido no recebimento / lote / observação"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button
              disabled={!canSubmit}
              onClick={() => {
                const qty = Number(quantity);
                if (!Number.isFinite(qty) || qty <= 0) {
                  toast.error("Quantidade inválida");
                  return;
                }
                mut.mutate({ materialId, quantity: qty, reference, note });
              }}
            >
              {mut.isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando...
                </span>
              ) : (
                "Registrar entrada"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
