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

function formatCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  if (d.length <= 5) return d.replace(/(\d{5})/, "$1-");
  return d.replace(/(\d{5})(\d{0,3})/, "$1-$2");
}

async function lookupCep(cep: string) {
  const q = onlyDigits(cep);
  if (q.length !== 8) return null;
  const res = await fetch(`/api/br/cep?q=${q}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.data) return null;
  return json.data as { logradouro?: string; bairro?: string; localidade?: string; uf?: string };
}


function validateCnpj(cnpj: string) {
  const s = onlyDigits(cnpj);
  if (s.length !== 14) return false;
  if (/^(\d)\1+$/.test(s)) return false; // todos iguais

  const calc = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += Number(base[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
  const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];

  const d1 = calc(s.slice(0, 12), w1);
  const d2 = calc(s.slice(0, 12) + String(d1), w2);

  return s.endsWith(String(d1) + String(d2));
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

async function lookupCnpj(doc: string) {
  const q = onlyDigits(doc);

  // CPF: não fazemos lookup automático (segue manual)
  if (q.length === 11) {
    return { __skip: true, message: "CPF detectado. Preencha manualmente (lookup automático é só para CNPJ)." };
  }

  if (q.length !== 14) throw new Error("Documento inválido (CPF=11 dígitos, CNPJ=14 dígitos)");
  if (!validateCnpj(q)) throw new Error("CNPJ inválido (dígitos verificadores não conferem)");

  const res = await fetch(`/api/br/cnpj?q=${q}`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = data?.error ?? "Falha no lookup";
    if (code === "cnpj_not_found") throw new Error("CNPJ não encontrado na base pública (BrasilAPI). Preencha manualmente e cadastre assim mesmo.");
    throw new Error(code);
  }
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
  const [cepLoading, setCepLoading] = React.useState(false);

  const current = (editing as any) ?? form;

  const handleBlurCep = React.useCallback(async () => {
    const cep = onlyDigits(current?.addressZip ?? "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    setMsg(null);
    try {
      const d = await lookupCep(cep);
      if (d) {
        const patch = {
          addressZip: formatCep(cep),
          addressStreet: d.logradouro ?? current?.addressStreet ?? "",
          addressDistrict: d.bairro ?? current?.addressDistrict ?? "",
          addressCity: d.localidade ?? current?.addressCity ?? "",
          addressState: (d.uf ?? current?.addressState ?? "").toUpperCase(),
        };
        if (editing) setEditing((prev: any) => ({ ...prev, ...patch }));
        else setForm((prev: any) => ({ ...prev, ...patch }));
        setMsg("Endereço preenchido pelo CEP.");
      }
    } catch {
      setMsg("CEP não encontrado.");
    } finally {
      setCepLoading(false);
    }
  }, [current?.addressZip, current?.addressStreet, current?.addressDistrict, current?.addressCity, current?.addressState, editing]);

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
      if (d?.__skip) {
        setMsg(d.message ?? "Documento não é CNPJ. Preencha manualmente.");
        return;
      }

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
                  disabled={cnpjMut.isPending || (onlyDigits(String(current.document ?? "")).length === 14 ? !validateCnpj(String(current.document ?? "")) : false)}
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

            <Field label="CEP" hint="Digite e saia do campo para buscar endereço automaticamente">
              <Input
                placeholder="00000-000"
                value={current.addressZip ?? ""}
                onChange={(e) => setVal("addressZip", formatCep(e.target.value))}
                onBlur={handleBlurCep}
                disabled={cepLoading}
              />
              {cepLoading && <span className="text-xs text-muted-foreground">Buscando...</span>}
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


