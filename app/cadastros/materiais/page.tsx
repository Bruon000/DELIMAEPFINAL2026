"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchUnits() {
  const res = await fetch("/api/units");
  if (!res.ok) throw new Error("Erro ao carregar unidades");
  return res.json();
}

async function fetchMaterials() {
  const res = await fetch("/api/materials");
  if (!res.ok) throw new Error("Erro ao carregar materiais");
  return res.json();
}

async function createMaterial(payload: any) {
  const res = await fetch("/api/materials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
  return data.material;
}

async function updateMaterial(id: string, payload: any) {
  const res = await fetch(`/api/materials/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
  return data.material;
}

async function deleteMaterial(id: string) {
  const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao remover");
  return data;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function MateriaisPage() {
  const qc = useQueryClient();
  const { data: unitsData } = useQuery({ queryKey: ["units"], queryFn: fetchUnits });
  const { data: matData, isLoading } = useQuery({ queryKey: ["materials"], queryFn: fetchMaterials });

  const units = unitsData?.units ?? [];
  const materials = matData?.materials ?? [];

  const [form, setForm] = React.useState({ name: "", unitId: "", code: "", currentCost: 0, minStock: "" as any });
  const [editing, setEditing] = React.useState<any>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: createMaterial,
    onSuccess: async () => {
      setMsg("Material criado!");
      setForm({ name: "", unitId: "", code: "", currentCost: 0, minStock: "" as any });
      await qc.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: any) => updateMaterial(id, payload),
    onSuccess: async () => {
      setMsg("Material atualizado!");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: deleteMaterial,
    onSuccess: async () => {
      setMsg("Material removido!");
      await qc.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const current = editing ?? form;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Materiais</h1>
        <Button asChild variant="outline">
          <Link href="/cadastros">Voltar</Link>
        </Button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>{editing ? "Editar material" : "Novo material"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome *" hint="Ex.: Tubo 30x30, Chapa 2mm, Trava, Parafuso...">
              <Input
                placeholder="Nome do material"
                value={current.name ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  editing ? setEditing({ ...editing, name: v }) : setForm({ ...form, name: v });
                }}
              />
            </Field>

            <Field label="Unidade *" hint="Ex.: m, kg, un, barra">
              <select
                className="border rounded p-2 w-full"
                value={current.unitId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  editing ? setEditing({ ...editing, unitId: v }) : setForm({ ...form, unitId: v });
                }}
              >
                <option value="">Selecione…</option>
                {units.map((u: any) => (
                  <option key={u.id} value={u.id}>
                    {u.code} - {u.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Código" hint="Código interno (opcional). Ex.: MAT-001">
              <Input
                placeholder="Código (opcional)"
                value={current.code ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  editing ? setEditing({ ...editing, code: v }) : setForm({ ...form, code: v });
                }}
              />
            </Field>

            <Field label="Custo atual (R$)" hint="Usado em relatórios/custo. Ex.: 12.50">
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={Number(current.currentCost ?? 0)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  editing ? setEditing({ ...editing, currentCost: v }) : setForm({ ...form, currentCost: v });
                }}
              />
            </Field>

            <Field label="Estoque mínimo" hint="Quando o saldo ficar abaixo disso, entra em alerta (opcional). Ex.: 5.0000">
              <Input
                type="number"
                step="0.0001"
                placeholder="(opcional)"
                value={current.minStock ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  editing ? setEditing({ ...editing, minStock: v }) : setForm({ ...form, minStock: v });
                }}
              />
            </Field>
          </div>

          <div className="flex gap-2">
            {!editing ? (
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name.trim() || !form.unitId}>
                {createMut.isPending ? "Salvando..." : "Criar"}
              </Button>
            ) : (
              <>
                <Button onClick={() => updateMut.mutate({ id: editing.id, payload: editing })} disabled={updateMut.isPending || !editing.name?.trim() || !editing.unitId}>
                  {updateMut.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p>Carregando...</p>}
          {materials.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{m.code ? `${m.code} - ` : ""}{m.name}</div>
                <div className="text-sm text-muted-foreground">
                  Unidade: {m.unit?.code ?? m.unitId} · Custo: R$ {Number(m.currentCost ?? 0).toFixed(2)} · Min: {m.minStock ?? "-"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(m)}>Editar</Button>
                <Button variant="destructive" size="sm" onClick={() => delMut.mutate(m.id)} disabled={delMut.isPending}>Remover</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
