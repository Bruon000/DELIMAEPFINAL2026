"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Client = {
  id: string;
  name: string;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
};

async function fetchClients(): Promise<Client[]> {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("Erro ao carregar clientes");
  const data = await res.json();
  return data.clients ?? [];
}

async function createClient(payload: any) {
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
  return data.client;
}

async function updateClient(id: string, payload: any) {
  const res = await fetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
  return data.client;
}

async function deleteClient(id: string) {
  const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao remover");
  return data;
}

export default function ClientesPage() {
  const qc = useQueryClient();
  const { data: clients, isLoading } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const [form, setForm] = React.useState({ name: "", document: "", email: "", phone: "" });
  const [editing, setEditing] = React.useState<Client | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: createClient,
    onSuccess: async () => {
      setMsg("Cliente criado!");
      setForm({ name: "", document: "", email: "", phone: "" });
      await qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: any) => updateClient(id, payload),
    onSuccess: async () => {
      setMsg("Cliente atualizado!");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: deleteClient,
    onSuccess: async () => {
      setMsg("Cliente removido!");
      await qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Clientes</h1>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>{editing ? "Editar cliente" : "Novo cliente"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Nome" value={editing ? editing.name : form.name} onChange={(e) => {
              const v = e.target.value;
              editing ? setEditing({ ...editing, name: v }) : setForm({ ...form, name: v });
            }} />
            <Input placeholder="Documento" value={(editing ? (editing.document ?? "") : form.document)} onChange={(e) => {
              const v = e.target.value;
              editing ? setEditing({ ...editing, document: v }) : setForm({ ...form, document: v });
            }} />
            <Input placeholder="Email" value={(editing ? (editing.email ?? "") : form.email)} onChange={(e) => {
              const v = e.target.value;
              editing ? setEditing({ ...editing, email: v }) : setForm({ ...form, email: v });
            }} />
            <Input placeholder="Telefone" value={(editing ? (editing.phone ?? "") : form.phone)} onChange={(e) => {
              const v = e.target.value;
              editing ? setEditing({ ...editing, phone: v }) : setForm({ ...form, phone: v });
            }} />
          </div>

          <div className="flex gap-2">
            {!editing ? (
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name.trim()}>
                {createMut.isPending ? "Salvando..." : "Criar"}
              </Button>
            ) : (
              <>
                <Button onClick={() => updateMut.mutate({ id: editing.id, payload: editing })} disabled={updateMut.isPending || !editing.name.trim()}>
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
          {(clients ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">{c.name} {!c.isActive && <span className="text-xs text-muted-foreground">(inativo)</span>}</div>
                <div className="text-sm text-muted-foreground">
                  {c.document ? `Doc: ${c.document} · ` : ""}{c.email ? `Email: ${c.email} · ` : ""}{c.phone ? `Tel: ${c.phone}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}>Editar</Button>
                <Button variant="destructive" size="sm" onClick={() => delMut.mutate(c.id)} disabled={delMut.isPending}>Remover</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
