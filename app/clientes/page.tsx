"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  readiness?: {
    docType: "CPF" | "CNPJ";
    nfceReady: boolean;
    nfeReady: boolean;
    missingNfe: string[];
  };
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
  return json.data as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; ibge?: string };
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

  const clients: Client[] = React.useMemo(
    () => data?.clients ?? data?.items ?? data?.data ?? [],
    [data],
  );

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
  const [q, setQ] = React.useState("");
  const [cepLoading, setCepLoading] = React.useState(false);

  // vendedor não entra em modo edição
  React.useEffect(() => {
    if (!canManage && editing) setEditing(null);
  }, [canManage, editing]);

  const current = editing ?? form;
  const digits = onlyDigits(String(current?.document ?? ""));
  const isCnpj = String(current?.docType ?? "CPF") === "CNPJ" || digits.length === 14;

  const setVal = (key: string, val: any) => {
    if (editing) setEditing({ ...(editing as any), [key]: val });
    else setForm({ ...form, [key]: val });
  };

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
          cityCodeIbge: d.ibge ?? current?.cityCodeIbge ?? "",
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
  }, [current?.addressZip, current?.addressStreet, current?.addressDistrict, current?.addressCity, current?.addressState, current?.cityCodeIbge, editing]);

  const onChangeDocType = (t: "CPF" | "CNPJ") => {
    const patch: any = { docType: t };
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
    return p;
  };

  const filteredClients = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients;
    return clients.filter((c) => {
      const hay = [
        c.name,
        c.tradeName,
        c.document,
        c.phone,
        c.email,
        c.addressCity,
        c.addressState,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return hay.includes(needle);
    });
  }, [clients, q]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Cadastro completo para NFC-e e NF-e, com foco fiscal e operacional.</p>
        </div>

        <Button asChild variant="outline">
          <Link href={canManage ? "/cadastros" : "/comercial/venda"}>Voltar</Link>
        </Button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>{editing ? "Editar cliente" : "Novo cliente / cadastro fiscal"}</CardTitle></CardHeader>
        <CardContent className="space-y-6">
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
            <div className="ml-auto flex flex-wrap gap-2">
              <Badge variant={digits.length === 14 ? "default" : "secondary"}>
                {digits.length === 14 ? "Perfil PJ / NF-e forte" : "Perfil PF / NFC-e forte"}
              </Badge>
              <Badge variant="outline">Cadastro inteligente por tipo de cliente</Badge>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field
                  label={isCnpj ? "CNPJ" : "CPF"}
                  hint={isCnpj ? 'Digite e clique em "Buscar CNPJ" para preencher automático (BrasilAPI)' : "CPF pode ser simples. Complete endereço quando precisar emitir NF-e com mais dados do destinatário."}
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
                    <Field label="Nome fantasia" hint="Opcional, mas recomendado para PJ">
                      <Input placeholder="Nome fantasia" value={current.tradeName ?? ""} onChange={(e) => setVal("tradeName", e.target.value)} />
                    </Field>

                    <Field label="IE / Inscrição Estadual" hint="Opcional">
                      <Input placeholder="IE (opcional)" value={current.ie ?? ""} onChange={(e) => setVal("ie", e.target.value)} />
                    </Field>

                    <Field label="IM / Inscrição Municipal" hint="Opcional">
                      <Input placeholder="IM (opcional)" value={current.im ?? ""} onChange={(e) => setVal("im", e.target.value)} />
                    </Field>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Status fiscal</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg border p-3">
                  <div className="font-medium">NFC-e</div>
                  <div className="text-muted-foreground">Cadastro recomendado para balcão, CPF e consumidor final.</div>
                  <div className="mt-2">
                    <Badge variant={String(current.name ?? "").trim() && String(current.document ?? "").trim() ? "default" : "secondary"}>
                      {String(current.name ?? "").trim() && String(current.document ?? "").trim() ? "Boa base para NFC-e" : "Preencha nome e documento"}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="font-medium">NF-e</div>
                  <div className="text-muted-foreground">Mais comum em CNPJ, mas também pode sair para CPF quando necessário.</div>
                  <div className="mt-2">
                    <Badge variant={String(current.document ?? "").trim() ? "default" : "secondary"}>
                      {String(current.document ?? "").trim() ? (isCnpj ? "Base fiscal de PJ iniciada" : "Base fiscal de PF iniciada") : "Documento obrigatório"}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {isCnpj
                      ? "Para CNPJ, complete o endereço principal para deixar a emissão mais consistente."
                      : "Para CPF, o cadastro pode ser simples; complete endereço quando o cenário exigir."}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Contato e endereço</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Email" hint="Opcional">
                <Input placeholder="email@cliente.com" value={current.email ?? ""} onChange={(e) => setVal("email", e.target.value)} />
              </Field>

              <Field label="Telefone" hint="Opcional">
                <Input placeholder="(xx) xxxxx-xxxx" value={current.phone ?? ""} onChange={(e) => setVal("phone", e.target.value)} />
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

              <Field label="Logradouro" hint="Rua/Av">
                <Input placeholder="Rua/Av" value={current.addressStreet ?? ""} onChange={(e) => setVal("addressStreet", e.target.value)} />
              </Field>

              <Field label="Número" hint={isCnpj ? "Obrigatório para NF-e" : "Opcional, mas recomendado"}>
                <Input placeholder="Número" value={current.addressNumber ?? ""} onChange={(e) => setVal("addressNumber", e.target.value)} />
              </Field>

              <Field label="Bairro" hint={isCnpj ? "Obrigatório para NF-e" : "Opcional, mas recomendado"}>
                <Input placeholder="Bairro" value={current.addressDistrict ?? ""} onChange={(e) => setVal("addressDistrict", e.target.value)} />
              </Field>

              <Field label="Cidade" hint={isCnpj ? "Importante para NF-e" : "Opcional por enquanto"}>
                <Input placeholder="Cidade" value={current.addressCity ?? ""} onChange={(e) => setVal("addressCity", e.target.value)} />
              </Field>

              <Field label="UF" hint="Ex.: SP, RJ, CE">
                <Input placeholder="UF" value={current.addressState ?? ""} onChange={(e) => setVal("addressState", e.target.value.toUpperCase())} />
              </Field>

              <Field label="cMun IBGE" hint="Opcional por enquanto">
                <Input placeholder="Ex.: 2304400" value={current.cityCodeIbge ?? ""} onChange={(e) => setVal("cityCodeIbge", e.target.value)} />
              </Field>
            </CardContent>
          </Card>

          

          <div className="flex gap-2">
            {!editing ? (
              <Button
                onClick={() => createMut.mutate(payloadForSave(form))}
                disabled={createMut.isPending || !String(form.name ?? "").trim()}
              >
                {createMut.isPending ? "Salvando..." : "Criar cliente"}
              </Button>
            ) : canManage ? (
              <>
                <Button
                  onClick={() => updateMut.mutate({ id: editing.id, payload: payloadForSave(editing) })}
                  disabled={updateMut.isPending || !String(editing.name ?? "").trim()}
                >
                  {updateMut.isPending ? "Salvando..." : "Salvar alterações"}
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
        <CardContent className="space-y-4">
          <Input
            placeholder="Buscar por nome, documento, telefone, email, cidade..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {isLoading && <p>Carregando...</p>}
          {filteredClients.map((c) => (
            <div key={c.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-base">{c.name}</div>
                    {c.tradeName ? <span className="text-sm text-muted-foreground">· {c.tradeName}</span> : null}
                    <Badge variant={c.readiness?.nfceReady ? "default" : "secondary"}>NFC-e</Badge>
                    <Badge variant={c.readiness?.nfeReady ? "default" : "secondary"}>NF-e</Badge>
                    {!c.isActive && <Badge variant="outline">Inativo</Badge>}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {c.document ? `Doc: ${c.document}` : "Sem documento"}{" · "}
                    {c.phone ? `Tel: ${c.phone}` : "Sem telefone"}{" · "}
                    {c.email ? `Email: ${c.email}` : "Sem email"}
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {[c.addressStreet, c.addressNumber, c.addressDistrict, c.addressCity, c.addressState]
                      .filter(Boolean)
                      .join(", ") || "Endereço não informado"}
                  </div>

                  {c.readiness?.missingNfe?.length ? (
                    <div className="text-xs text-amber-600">
                      Pendências NF-e: {c.readiness.missingNfe.join(", ")}
                    </div>
                  ) : null}
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
            </div>
          ))}
          {filteredClients.length === 0 && !isLoading && <p className="text-muted-foreground">Sem clientes.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

