"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Unit = { id: string; code: string; name: string; isActive: boolean };

async function fetchUnits(): Promise<Unit[]> {
  const res = await fetch("/api/units");
  if (!res.ok) throw new Error("Erro ao carregar unidades");
  const data = await res.json();
  return data.units ?? [];
}

async function createUnit(payload: any) {
  const res = await fetch("/api/units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
  return data.unit;
}

async function updateUnit(id: string, payload: any) {
  const res = await fetch(`/api/units/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
  return data.unit;
}

async function deleteUnit(id: string) {
  const res = await fetch(`/api/units/${id}`, { method: "DELETE" });
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

export default function UnidadesPage() {
  const qc = useQueryClient();
  const { data: units, isLoading } = useQuery({ queryKey: ["units"], queryFn: fetchUnits });

  const [form, setForm] = React.useState({ code: "", name: "" });
  const [editing, setEditing] = React.useState<Unit | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: createUnit,
    onSuccess: async () => {
      setMsg("Unidade criada!");
      setForm({ code: "", name: "" });
      await qc.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: any) => updateUnit(id, payload),
    onSuccess: async () => {
      setMsg("Unidade atualizada!");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: deleteUnit,
    onSuccess: async () => {
      setMsg("Unidade removida (inativada)!");
      await qc.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const current: any = editing ?? form;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Unidades</h1>
        <Button asChild variant="outline"><Link href="/cadastros">Voltar</Link></Button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>{editing ? "Editar unidade" : "Nova unidade"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Código *" hint="Ex.: un, m, m2, kg, l, barra">
              <Input
                placeholder="un"
                value={String(current.code ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  editing ? setEditing({ ...editing, code: v }) : setForm({ ...form, code: v });
                }}
              />
            </Field>

            <Field label="Nome *" hint="Ex.: Unidade, Metro, Quilograma, Litro...">
              <Input
                placeholder="Nome da unidade"
                value={String(current.name ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  editing ? setEditing({ ...editing, name: v }) : setForm({ ...form, name: v });
                }}
              />
            </Field>
          </div>

          <div className="flex gap-2">
            {!editing ? (
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.code.trim() || !form.name.trim()}>
                {createMut.isPending ? "Salvando..." : "Criar"}
              </Button>
            ) : (
              <>
                <Button onClick={() => updateMut.mutate({ id: editing.id, payload: editing })} disabled={updateMut.isPending || !editing.code.trim() || !editing.name.trim()}>
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
          {(units ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{u.code} - {u.name}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(u)}>Editar</Button>
                <Button variant="destructive" size="sm" onClick={() => delMut.mutate(u.id)} disabled={delMut.isPending}>Remover</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
