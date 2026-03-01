"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Supplier = {
  id: string;
  name: string;
  tradeName?: string | null;
  document?: string | null;
  ie?: string | null;
  im?: string | null;
  email?: string | null;
  phone?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressDistrict?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  isActive: boolean;
};

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
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

async function fetchSuppliers() {
  const res = await fetch("/api/suppliers");
  if (!res.ok) throw new Error("Erro ao carregar fornecedores");
  return res.json();
}

async function createSupplier(payload: any) {
  const res = await fetch("/api/suppliers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
  return data.supplier;
}

async function updateSupplier(id: string, payload: any) {
  const res = await fetch(`/api/suppliers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
  return data.supplier;
}

async function deleteSupplier(id: string) {
  const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao remover");
  return data;
}

async function lookupCnpj(cnpj: string) {
  const q = onlyDigits(cnpj);
  if (q.length !== 14) throw new Error("CNPJ inválido (precisa ter 14 dígitos)");
  const res = await fetch(`/api/br/cnpj?q=${q}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Falha no lookup");
  return data.data;
}

export default function FornecedoresPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });

  const suppliers: Supplier[] = data?.suppliers ?? [];

  const [form, setForm] = React.useState<any>({
    name: "",
    tradeName: "",
    document: "",
    ie: "",
    im: "",
    email: "",
    phone: "",
    addressStreet: "",
    addressNumber: "",
    addressDistrict: "",
    addressCity: "",
    addressState: "",
    addressZip: "",
  });

  const [editing, setEditing] = React.useState<Supplier | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const current = (editing as any) ?? form;

  const createMut = useMutation({
    mutationFn: createSupplier,
    onSuccess: async () => {
      setMsg("Fornecedor criado!");
      setForm({
        name: "",
        tradeName: "",
        document: "",
        ie: "",
        im: "",
        email: "",
        phone: "",
        addressStreet: "",
        addressNumber: "",
        addressDistrict: "",
        addressCity: "",
        addressState: "",
        addressZip: "",
      });
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: any) => updateSupplier(id, payload),
    onSuccess: async () => {
      setMsg("Fornecedor atualizado!");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const delMut = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: async () => {
      setMsg("Fornecedor removido!");
      await qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const cnpjMut = useMutation({
    mutationFn: (cnpj: string) => lookupCnpj(cnpj),
    onSuccess: (d: any) => {
      // preenche automático (sem travar IE/IM — pode deixar em branco e completar depois)
      const next: any = {
        document: d?.cnpj ?? current.document ?? "",
        name: d?.razaoSocial ?? current.name ?? "",
        tradeName: d?.nomeFantasia ?? current.tradeName ?? "",
        email: d?.email ?? current.email ?? "",
        phone: d?.telefone ?? current.phone ?? "",
        addressStreet: d?.logradouro ?? current.addressStreet ?? "",
        addressNumber: d?.numero ?? current.addressNumber ?? "",
        addressDistrict: d?.bairro ?? current.addressDistrict ?? "",
        addressCity: d?.municipio ?? current.addressCity ?? "",
        addressState: d?.uf ?? current.addressState ?? "",
        addressZip: d?.cep ?? current.addressZip ?? "",
      };

      if (editing) setEditing({ ...(editing as any), ...next });
      else setForm({ ...form, ...next });

      setMsg("Dados preenchidos pelo CNPJ. (IE/IM podem ficar em branco)");
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const setVal = (key: string, val: any) => {
    if (editing) setEditing({ ...(editing as any), [key]: val });
    else setForm({ ...form, [key]: val });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fornecedores</h1>
        <Button asChild variant="outline">
          <Link href="/cadastros">Voltar</Link>
        </Button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="CNPJ/CPF" hint="Digite e clique em “Buscar CNPJ” para preencher automático (BrasilAPI)">
              <div className="flex gap-2">
                <Input
                  placeholder="00.000.000/0000-00"
                  value={current.document ?? ""}
                  onChange={(e) => setVal("document", e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={() => cnpjMut.mutate(String(current.document ?? ""))}
                  disabled={cnpjMut.isPending || onlyDigits(String(current.document ?? "")).length !== 14}
                >
                  {cnpjMut.isPending ? "Buscando..." : "Buscar CNPJ"}
                </Button>
              </div>
            </Field>

            <Field label="Razão social / Nome *" hint="Razão social (CNPJ) ou nome do fornecedor">
              <Input placeholder="Nome" value={current.name ?? ""} onChange={(e) => setVal("name", e.target.value)} />
            </Field>

            <Field label="Nome fantasia" hint="Opcional">
              <Input placeholder="Nome fantasia" value={current.tradeName ?? ""} onChange={(e) => setVal("tradeName", e.target.value)} />
            </Field>

            <Field label="IE / Inscrição Estadual" hint="Pode ficar em branco e preencher depois">
              <Input placeholder="IE (opcional)" value={current.ie ?? ""} onChange={(e) => setVal("ie", e.target.value)} />
            </Field>

            <Field label="IM / Inscrição Municipal" hint="Pode ficar em branco e preencher depois">
              <Input placeholder="IM (opcional)" value={current.im ?? ""} onChange={(e) => setVal("im", e.target.value)} />
            </Field>

            <Field label="Email" hint="Opcional">
              <Input placeholder="email@fornecedor.com" value={current.email ?? ""} onChange={(e) => setVal("email", e.target.value)} />
            </Field>

            <Field label="Telefone" hint="Opcional">
              <Input placeholder="(xx) xxxxx-xxxx" value={current.phone ?? ""} onChange={(e) => setVal("phone", e.target.value)} />
            </Field>

            <Field label="Logradouro" hint="Rua/Av">
              <Input placeholder="Rua/Av" value={current.addressStreet ?? ""} onChange={(e) => setVal("addressStreet", e.target.value)} />
            </Field>

            <Field label="Número" hint="Opcional">
              <Input placeholder="Número" value={current.addressNumber ?? ""} onChange={(e) => setVal("addressNumber", e.target.value)} />
            </Field>

            <Field label="Bairro" hint="Opcional">
              <Input placeholder="Bairro" value={current.addressDistrict ?? ""} onChange={(e) => setVal("addressDistrict", e.target.value)} />
            </Field>

            <Field label="Cidade" hint="Opcional">
              <Input placeholder="Cidade" value={current.addressCity ?? ""} onChange={(e) => setVal("addressCity", e.target.value)} />
            </Field>

            <Field label="UF" hint="Ex.: SP, RJ, CE">
              <Input placeholder="UF" value={current.addressState ?? ""} onChange={(e) => setVal("addressState", e.target.value)} />
            </Field>

            <Field label="CEP" hint="Ex.: 00000-000">
              <Input placeholder="CEP" value={current.addressZip ?? ""} onChange={(e) => setVal("addressZip", e.target.value)} />
            </Field>
          </div>

          <div className="flex gap-2">
            {!editing ? (
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !String(form.name ?? "").trim()}>
                {createMut.isPending ? "Salvando..." : "Criar"}
              </Button>
            ) : (
              <>
                <Button onClick={() => updateMut.mutate({ id: editing.id, payload: editing })} disabled={updateMut.isPending || !String(editing.name ?? "").trim()}>
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
          {suppliers.map((s) => (
            <div key={s.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">
                  {s.name} {s.tradeName ? <span className="text-sm text-muted-foreground">· {s.tradeName}</span> : null}
                  {!s.isActive && <span className="text-xs text-muted-foreground"> (inativo)</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {s.document ? `Doc: ${s.document} · ` : ""}{s.email ? `Email: ${s.email} · ` : ""}{s.phone ? `Tel: ${s.phone}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(s)}>Editar</Button>
                <Button variant="destructive" size="sm" onClick={() => delMut.mutate(s.id)} disabled={delMut.isPending}>Remover</Button>
              </div>
            </div>
          ))}
          {suppliers.length === 0 && !isLoading && <p className="text-muted-foreground">Sem fornecedores.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
