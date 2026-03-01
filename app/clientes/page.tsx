"use client";

import * as React from "react";
import Link from "next/link";
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

// máscara simples (visual) — não bloqueia colar/editar
function formatCpfCnpj(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  // CNPJ: 00.000.000/0000-00
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    // (11) 9999-9999
    return d
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  // (11) 99999-9999
  return d
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}

export default function ClientesPage() {
  const qc = useQueryClient();
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: fetchClients,
  });

  const [form, setForm] = React.useState({
    name: "",
    document: "",
    email: "",
    phone: "",
  });
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

  const current: any = editing ?? form;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Button asChild variant="outline">
          <Link href="/cadastros">Voltar</Link>
        </Button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Editar cliente" : "Novo cliente"}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome *" hint="Nome/Razão social">
              <Input
                placeholder="Ex.: João da Silva / Serralheria XPTO"
                value={current.name ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  editing
                    ? setEditing({ ...editing, name: v })
                    : setForm({ ...form, name: v });
                }}
              />
            </Field>

            <Field label="Documento" hint="CPF ou CNPJ (opcional)">
              <Input
                placeholder="000.000.000-00 / 00.000.000/0000-00"
                value={formatCpfCnpj(String(current.document ?? ""))}
                onChange={(e) => {
                  const raw = e.target.value;
                  editing
                    ? setEditing({ ...editing, document: raw })
                    : setForm({ ...form, document: raw });
                }}
              />
            </Field>

            <Field label="Email" hint="Opcional (para envio de orçamento/recibos)">
              <Input
                placeholder="email@exemplo.com"
                type="email"
                value={String(current.email ?? "")}
                onChange={(e) => {
                  const v = e.target.value;
                  editing
                    ? setEditing({ ...editing, email: v })
                    : setForm({ ...form, email: v });
                }}
              />
            </Field>

            <Field label="Telefone" hint="Opcional">
              <Input
                placeholder="(11) 99999-9999"
                value={formatPhone(String(current.phone ?? ""))}
                onChange={(e) => {
                  const v = e.target.value;
                  editing
                    ? setEditing({ ...editing, phone: v })
                    : setForm({ ...form, phone: v });
                }}
              />
            </Field>
          </div>

          <div className="flex gap-2">
            {!editing ? (
              <Button
                onClick={() => createMut.mutate(form)}
                disabled={createMut.isPending || !String(form.name).trim()}
              >
                {createMut.isPending ? "Salvando..." : "Criar"}
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => updateMut.mutate({ id: editing.id, payload: editing })}
                  disabled={updateMut.isPending || !String(editing.name).trim()}
                >
                  {updateMut.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
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
                <div className="font-medium">
                  {c.name} {!c.isActive && <span className="text-xs text-muted-foreground">(inativo)</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {c.document ? `Doc: ${c.document} · ` : ""}
                  {c.email ? `Email: ${c.email} · ` : ""}
                  {c.phone ? `Tel: ${c.phone}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}>Editar</Button>
                <Button variant="destructive" size="sm" onClick={() => delMut.mutate(c.id)} disabled={delMut.isPending}>
                  Remover
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
