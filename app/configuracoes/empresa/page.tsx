"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchCfg() {
  const res = await fetch("/api/company-config");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar");
  return data as Record<string, unknown>;
}

async function saveCfg(payload: Record<string, unknown>) {
  const res = await fetch("/api/company-config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) ?? (data?.message as string) ?? "Erro ao salvar");
  return data as Record<string, unknown>;
}

async function fetchCompanyFiscal() {
  const res = await fetch("/api/company-fiscal");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data?.error as string) ?? (data?.message as string) ?? "Erro ao carregar fiscal do emitente");
  return data as { fiscal?: Record<string, unknown>; readiness?: { pending?: string[] } };
}

async function saveCompanyFiscal(payload: Record<string, unknown>) {
  const res = await fetch("/api/company-fiscal", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data?.message as string) ?? (data?.error as string) ?? "Erro ao salvar fiscal do emitente");
    (err as Error & { issues?: string[] }).issues = data?.issues as string[] | undefined;
    throw err;
  }
  return data as { fiscal?: Record<string, unknown>; readiness?: { pending?: string[] } };
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const v = onlyDigits(value).slice(0, 14);
  return v
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatCep(value: string) {
  const v = onlyDigits(value).slice(0, 8);
  return v.replace(/^(\d{5})(\d)/, "$1-$2");
}

function normalizeUf(value: string) {
  return value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2);
}

function buildEmitentePending(fiscal: Record<string, unknown>) {
  const pending: string[] = [];
  if (!String(fiscal.legalName ?? "").trim()) pending.push("Razão social do emitente");
  if (!String(fiscal.ie ?? "").trim()) pending.push("Inscrição Estadual");
  if (!["1", "2", "3"].includes(String(fiscal.crt ?? ""))) pending.push("CRT");
  if (!String(fiscal.addressStreet ?? "").trim()) pending.push("Logradouro");
  if (!String(fiscal.addressNumber ?? "").trim()) pending.push("Número");
  if (!String(fiscal.addressDistrict ?? "").trim()) pending.push("Bairro");
  if (!String(fiscal.addressCity ?? "").trim()) pending.push("Município");
  if (!/^[A-Z]{2}$/.test(String(fiscal.addressState ?? ""))) pending.push("UF");
  if (onlyDigits(String(fiscal.addressZip ?? "")).length !== 8) pending.push("CEP");
  if (onlyDigits(String(fiscal.cityCodeIbge ?? "")).length !== 7) pending.push("cMun IBGE");
  return pending;
}

export default function EmpresaConfigPage() {
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["company-config"], queryFn: fetchCfg });
  const qFiscal = useQuery({ queryKey: ["company-fiscal"], queryFn: fetchCompanyFiscal });

  const [form, setForm] = React.useState({
    name: "",
    document: "",
    email: "",
    phone: "",
    regime: "",
    certSerial: "",
  });

  const [fiscal, setFiscal] = React.useState({
    legalName: "",
    tradeName: "",
    ie: "",
    crt: "",
    addressStreet: "",
    addressNumber: "",
    addressDistrict: "",
    addressCity: "",
    addressState: "",
    addressZip: "",
    cityCodeIbge: "",
  });

  const [cepLoading, setCepLoading] = React.useState(false);

  React.useEffect(() => {
    const data = q.data;
    if (!data) return;
    const company = data?.company as Record<string, unknown> | undefined;
    const fiscalData = data?.fiscal as Record<string, unknown> | undefined;
    setForm({
      name: (company?.name as string) ?? "",
      document: company?.document ? formatCnpj(String(company.document)) : "",
      email: (company?.email as string) ?? "",
      phone: (company?.phone as string) ?? "",
      regime: (fiscalData?.regime as string) ?? "",
      certSerial: (fiscalData?.certSerial as string) ?? "",
    });
  }, [q.data]);

  React.useEffect(() => {
    const data = qFiscal.data;
    if (!data) return;
    const f = data?.fiscal ?? {};
    setFiscal({
      legalName: (f?.legalName as string) ?? "",
      tradeName: (f?.tradeName as string) ?? "",
      ie: (f?.ie as string) ?? "",
      crt: f?.crt != null ? String(f.crt) : "",
      addressStreet: (f?.addressStreet as string) ?? "",
      addressNumber: (f?.addressNumber as string) ?? "",
      addressDistrict: (f?.addressDistrict as string) ?? "",
      addressCity: (f?.addressCity as string) ?? "",
      addressState: (f?.addressState as string) ?? "",
      addressZip: f?.addressZip ? formatCep(String(f.addressZip)) : "",
      cityCodeIbge: (f?.cityCodeIbge as string) ?? "",
    });
  }, [qFiscal.data]);

  const mut = useMutation({
    mutationFn: saveCfg,
    onSuccess: async () => {
      toast.success("Configuração da empresa salva.");
      await qc.invalidateQueries({ queryKey: ["company-config"] });
    },
    onError: (e: Error & { issues?: string[] }) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const mutFiscal = useMutation({
    mutationFn: saveCompanyFiscal,
    onSuccess: async (data) => {
      toast.success("Emitente fiscal salvo.");
      if (Array.isArray(data?.readiness?.pending) && data.readiness.pending.length > 0) {
        toast.warning(`Ainda existem pendências fiscais: ${data.readiness.pending.length}`);
      }
      await qc.invalidateQueries({ queryKey: ["company-fiscal"] });
    },
    onError: (e: Error & { issues?: string[] }) => {
      const issues = Array.isArray(e?.issues) ? e.issues.join(" | ") : e?.message;
      toast.error(issues || "Erro ao salvar emitente fiscal");
    },
  });

  async function handleBuscarCep() {
    const cep = onlyDigits(fiscal.addressZip);
    if (cep.length !== 8) {
      toast.error("Informe um CEP com 8 dígitos.");
      return;
    }

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok || data?.erro) {
        throw new Error("CEP não encontrado.");
      }

      setFiscal((prev) => ({
        ...prev,
        addressStreet: (data?.logradouro as string) || prev.addressStreet,
        addressDistrict: (data?.bairro as string) || prev.addressDistrict,
        addressCity: (data?.localidade as string) || prev.addressCity,
        addressState: (data?.uf as string) || prev.addressState,
        cityCodeIbge: (data?.ibge as string) || prev.cityCodeIbge,
        addressZip: formatCep(cep),
      }));

      toast.success("CEP localizado. Endereço e IBGE preenchidos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível consultar o CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  const emitentePending = buildEmitentePending(fiscal);

  if (q.isLoading || qFiscal.isLoading) return <div className="p-6">Carregando...</div>;
  if (q.isError) return <div className="p-6 text-red-600">Erro: {(q.error as Error)?.message ?? "Falha"}</div>;
  if (qFiscal.isError) return <div className="p-6 text-red-600">Erro: {(qFiscal.error as Error)?.message ?? "Falha"}</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Configurações · Empresa & Fiscal</h1>
          <p className="text-sm text-muted-foreground">
            Cadastre a empresa e complete o emitente fiscal. Sem cMun IBGE, CRT e endereço fiscal completo a emissão deve ser bloqueada.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/configuracoes">Voltar</Link>
        </Button>
      </div>

      <Card className={emitentePending.length === 0 ? "border-green-500" : "border-amber-500"}>
        <CardHeader>
          <CardTitle>Diagnóstico do emitente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            Status:{" "}
            <span className={emitentePending.length === 0 ? "font-semibold text-green-600" : "font-semibold text-amber-600"}>
              {emitentePending.length === 0 ? "Pronto para informar ao emissor" : "Configuração incompleta"}
            </span>
          </div>
          {emitentePending.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {emitentePending.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Emitente completo para NF-e/NFC-e.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nome da empresa</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CNPJ</label>
            <Input
              value={form.document}
              onChange={(e) => setForm({ ...form, document: formatCnpj(e.target.value) })}
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">E-mail</label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Telefone</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Regime base</label>
            <Input value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })} placeholder="Ex.: SIMPLES" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Serial do certificado</label>
            <Input
              value={form.certSerial}
              onChange={(e) => setForm({ ...form, certSerial: e.target.value })}
              placeholder="Opcional, referência interna"
            />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button onClick={() => mut.mutate({ ...form, document: onlyDigits(form.document) })} disabled={mut.isPending}>
              {mut.isPending ? "Salvando..." : "Salvar dados da empresa"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Emitente fiscal</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Razão social *</label>
            <Input value={fiscal.legalName} onChange={(e) => setFiscal({ ...fiscal, legalName: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nome fantasia</label>
            <Input value={fiscal.tradeName} onChange={(e) => setFiscal({ ...fiscal, tradeName: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Inscrição Estadual *</label>
            <Input value={fiscal.ie} onChange={(e) => setFiscal({ ...fiscal, ie: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CRT *</label>
            <select
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={fiscal.crt}
              onChange={(e) => setFiscal({ ...fiscal, crt: e.target.value })}
            >
              <option value="">Selecione</option>
              <option value="1">1 - Simples Nacional</option>
              <option value="2">2 - Simples Nacional - excesso sublimite</option>
              <option value="3">3 - Regime Normal</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">CEP *</label>
            <div className="flex gap-2">
              <Input
                value={fiscal.addressZip}
                onChange={(e) => setFiscal({ ...fiscal, addressZip: formatCep(e.target.value) })}
                onBlur={() => { if (onlyDigits(fiscal.addressZip).length === 8) handleBuscarCep(); }}
                placeholder="00000-000"
                disabled={cepLoading}
              />
              <Button type="button" variant="outline" onClick={handleBuscarCep} disabled={cepLoading}>
                {cepLoading ? "Buscando..." : "Buscar CEP"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Digite o CEP e saia do campo (ou clique em Buscar CEP) para preencher logradouro, bairro, cidade, UF e código IBGE.
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Logradouro *</label>
            <Input value={fiscal.addressStreet} onChange={(e) => setFiscal({ ...fiscal, addressStreet: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Número *</label>
            <Input value={fiscal.addressNumber} onChange={(e) => setFiscal({ ...fiscal, addressNumber: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bairro *</label>
            <Input value={fiscal.addressDistrict} onChange={(e) => setFiscal({ ...fiscal, addressDistrict: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Município *</label>
            <Input value={fiscal.addressCity} onChange={(e) => setFiscal({ ...fiscal, addressCity: e.target.value })} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">UF *</label>
            <Input value={fiscal.addressState} onChange={(e) => setFiscal({ ...fiscal, addressState: normalizeUf(e.target.value) })} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">cMun IBGE *</label>
            <Input
              value={fiscal.cityCodeIbge}
              onChange={(e) => setFiscal({ ...fiscal, cityCodeIbge: onlyDigits(e.target.value).slice(0, 7) })}
              placeholder="Ex.: 2304400"
            />
            <p className="text-xs text-muted-foreground">
              Código do município com 7 dígitos. Preenchido automaticamente ao localizar o CEP quando o serviço retornar o IBGE.
            </p>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button
              onClick={() =>
                mutFiscal.mutate({
                  ...fiscal,
                  crt: fiscal.crt ? Number(fiscal.crt) : null,
                  addressZip: onlyDigits(fiscal.addressZip),
                  cityCodeIbge: onlyDigits(fiscal.cityCodeIbge),
                  addressState: normalizeUf(fiscal.addressState),
                })
              }
              disabled={mutFiscal.isPending}
            >
              {mutFiscal.isPending ? "Salvando..." : "Salvar emitente fiscal"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
