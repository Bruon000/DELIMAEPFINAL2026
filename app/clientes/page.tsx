"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Client = {
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
  cityCodeIbge?: string | null;
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

async function fetchClients() {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("Erro ao carregar clientes");
  return res.json();
}

async function createClient(payload: any) {
  const res = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao criar");
  return data.client ?? data;
}

async function updateClient(id: string, payload: any) {
  const res = await fetch(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar");
  return data.client ?? data;
}

async function deleteClient(id: string) {
  const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
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

export default function ClientesPage() {
  const { data: session } = useSession();
  const role = String((session as any)?.user?.role ?? "");
  const canManage = role === "ADMIN";

  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["clients"], queryFn: fetchClients });

  const clients: Client[] = data?.clients ?? data?.items ?? data?.data ?? [];

  const emptyForm = {
    docType: "CPF" as "CPF" | "CNPJ",
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
    cityCodeIbge: "",
  };

  const [form, setForm] = React.useState<any>(emptyForm);
  const [editing, setEditing] = React.useState<any>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  // vendedor não entra em modo edição
  React.useEffect(() => {
    if (!canManage && editing) setEditing(null);
  }, [canManage, editing]);

  const current = editing ?? form;
  const isCnpj = String(current?.docType ?? "CPF") === "CNPJ";

  const setVal = (key: string, val: any) => {
    if (editing) setEditing({ ...(editing as any), [key]: val });
    else setForm({ ...form, [key]: val });
  };

  const onChangeDocType = (t: "CPF" | "CNPJ") => {
    const patch: any = { docType: t };
    if (t === "CPF") {
      patch.tradeName = "";
      patch.ie = "";
      patch.im = "";
      patch.addressStreet = "";
      patch.addressNumber = "";
      patch.addressDistrict = "";
      patch.addressCity = "";
      patch.addressState = "";
      patch.addressZip = "";
      patch.cityCodeIbge = "";
    }
    if (editing) setEditing({ ...(editing as any), ...patch });
    else setForm({ ...form, ...patch });
  };

  const createMut = useMutation({
    mutationFn: createClient,
    onSuccess: async () => {
      setMsg("Cliente criado!");
      setForm(emptyForm);
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

  const cnpjMut = useMutation({
    mutationFn: (cnpj: string) => lookupCnpj(cnpj),
    onSuccess: (d: any) => {
      if (!isCnpj) {
        setMsg("Troque para CNPJ para usar o preenchimento automático.");
        return;
      }

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

  const payloadForSave = (obj: any) => {
    const p: any = { ...obj };
    delete p.docType;

    if (String(obj?.docType ?? "CPF") === "CPF") {
      p.tradeName = "";
      p.ie = "";
      p.im = "";
      p.addressStreet = "";
      p.addressNumber = "";
      p.addressDistrict = "";
      p.addressCity = "";
      p.addressState = "";
      p.addressZip = "";
      p.cityCodeIbge = "";
    }
    return p;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>

        <Button asChild variant="outline">
          <Link href={canManage ? "/cadastros" : "/comercial/venda"}>Voltar</Link>
        </Button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>{editing ? "Editar cliente" : "Novo cliente"}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={String(current.docType ?? "CPF") === "CPF" ? "default" : "outline"}
              onClick={() => onChangeDocType("CPF")}
            >
              CPF
            </Button>
            <Button
              type="button"
              variant={String(current.docType ?? "CPF") === "CNPJ" ? "default" : "outline"}
              onClick={() => onChangeDocType("CNPJ")}
            >
              CNPJ
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label={isCnpj ? "CNPJ" : "CPF"}
              hint={isCnpj ? 'Digite e clique em "Buscar CNPJ" para preencher automático (BrasilAPI)' : "Apenas CPF + dados básicos"}
            >
              <div className="flex gap-2">
                <Input
                  placeholder={isCnpj ? "00.000.000/0000-00" : "000.000.000-00"}
                  value={current.document ?? ""}
                  onChange={(e) => setVal("document", e.target.value)}
                />
                {isCnpj ? (
                  <Button
                    variant="outline"
                    onClick={() => cnpjMut.mutate(String(current.document ?? ""))}
                    disabled={cnpjMut.isPending || onlyDigits(String(current.document ?? "")).length !== 14}
                  >
                    {cnpjMut.isPending ? "Buscando..." : "Buscar CNPJ"}
                  </Button>
                ) : null}
              </div>
            </Field>

            <Field label={isCnpj ? "Razão social / Nome *" : "Nome *"} hint={isCnpj ? "Razão social (CNPJ) ou nome do cliente" : "Nome do cliente"}>
              <Input placeholder="Nome" value={current.name ?? ""} onChange={(e) => setVal("name", e.target.value)} />
            </Field>

            {isCnpj ? (
              <>
                <Field label="Nome fantasia" hint="Opcional">
                  <Input placeholder="Nome fantasia" value={current.tradeName ?? ""} onChange={(e) => setVal("tradeName", e.target.value)} />
                </Field>

                <Field label="IE / Inscrição Estadual" hint="Pode ficar em branco e preencher depois">
                  <Input placeholder="IE (opcional)" value={current.ie ?? ""} onChange={(e) => setVal("ie", e.target.value)} />
                </Field>

                <Field label="IM / Inscrição Municipal" hint="Pode ficar em branco e preencher depois">
                  <Input placeholder="IM (opcional)" value={current.im ?? ""} onChange={(e) => setVal("im", e.target.value)} />
                </Field>
              </>
            ) : null}

            <Field label="Email" hint="Opcional">
              <Input placeholder="email@cliente.com" value={current.email ?? ""} onChange={(e) => setVal("email", e.target.value)} />
            </Field>

            <Field label="Telefone" hint="Opcional">
              <Input placeholder="(xx) xxxxx-xxxx" value={current.phone ?? ""} onChange={(e) => setVal("phone", e.target.value)} />
            </Field>

            {isCnpj ? (
              <>
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

                <Field label="cMun IBGE" hint="Código IBGE do município (importante para emissão fiscal)">
                  <Input placeholder="Ex.: 2304400" value={current.cityCodeIbge ?? ""} onChange={(e) => setVal("cityCodeIbge", e.target.value)} />
                </Field>
              </>
            ) : null}
          </div>

          <div className="flex gap-2">
            {!editing ? (
              <Button
                onClick={() => createMut.mutate(payloadForSave(form))}
                disabled={createMut.isPending || !String(form.name ?? "").trim()}
              >
                {createMut.isPending ? "Salvando..." : "Criar"}
              </Button>
            ) : canManage ? (
              <>
                <Button
                  onClick={() => updateMut.mutate({ id: editing.id, payload: payloadForSave(editing) })}
                  disabled={updateMut.isPending || !String(editing.name ?? "").trim()}
                >
                  {updateMut.isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              </>
            ) : null}
          </div>

          {!canManage ? (
            <div className="text-xs text-muted-foreground">
              Obs.: vendedor pode cadastrar clientes, mas alterações/exclusões são feitas pelo Admin.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lista</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p>Carregando...</p>}
          {clients.map((c) => (
            <div key={c.id} className="flex items-center justify-between border rounded p-3">
              <div>
                <div className="font-medium">
                  {c.name} {c.tradeName ? <span className="text-sm text-muted-foreground">· {c.tradeName}</span> : null}
                  {!c.isActive && <span className="text-xs text-muted-foreground"> (inativo)</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {c.document ? `Doc: ${c.document} · ` : ""}{c.email ? `Email: ${c.email} · ` : ""}{c.phone ? `Tel: ${c.phone}` : ""}
                </div>
              </div>

              {canManage ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing({ ...c, docType: (onlyDigits(String(c.document ?? "")).length === 14 ? "CNPJ" : "CPF") })}
                  >
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => delMut.mutate(c.id)} disabled={delMut.isPending}>
                    Remover
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Somente cadastro</span>
              )}
            </div>
          ))}
          {clients.length === 0 && !isLoading && <p className="text-muted-foreground">Sem clientes.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
