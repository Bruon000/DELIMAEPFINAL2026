"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function fetchCfg() {
  const res = await fetch("/api/company-config");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar");
  return data as any;
}

async function saveCfg(payload: any) {
  const res = await fetch("/api/company-config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Erro ao salvar");
  return data as any;
}

async function fetchCompanyFiscal() {
  const res = await fetch("/api/company-fiscal");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Erro ao carregar fiscal do emitente");
  return data as any; // { fiscal }
}

async function saveCompanyFiscal(payload: any) {
  const res = await fetch("/api/company-fiscal", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? data?.message ?? "Erro ao salvar fiscal do emitente");
  return data as any;
}

export default function EmpresaConfigPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["company-config"], queryFn: fetchCfg });
  const qFiscal = useQuery({ queryKey: ["company-fiscal"], queryFn: fetchCompanyFiscal });

  const [form, setForm] = React.useState<any>({
    name: "",
    document: "",
    email: "",
    phone: "",
    regime: "",
    certSerial: "",
  });

  const [fiscal, setFiscal] = React.useState<any>({
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

  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    const data = q.data;
    if (!data) return;
    setForm({
      name: data?.company?.name ?? "",
      document: data?.company?.document ?? "",
      email: data?.company?.email ?? "",
      phone: data?.company?.phone ?? "",
      regime: data?.fiscal?.regime ?? "",
      certSerial: data?.fiscal?.certSerial ?? "",
    });
  }, [q.data]);

  React.useEffect(() => {
    const data = qFiscal.data;
    if (!data) return;
    const f = data?.fiscal ?? {};
    setFiscal({
      legalName: f?.legalName ?? "",
      tradeName: f?.tradeName ?? "",
      ie: f?.ie ?? "",
      crt: f?.crt != null ? String(f.crt) : "",
      addressStreet: f?.addressStreet ?? "",
      addressNumber: f?.addressNumber ?? "",
      addressDistrict: f?.addressDistrict ?? "",
      addressCity: f?.addressCity ?? "",
      addressState: f?.addressState ?? "",
      addressZip: f?.addressZip ?? "",
      cityCodeIbge: f?.cityCodeIbge ?? "",
    });
  }, [qFiscal.data]);

  const mut = useMutation({
    mutationFn: saveCfg,
    onSuccess: async () => {
      setMsg("Configuração salva!");
      await qc.invalidateQueries({ queryKey: ["company-config"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  const mutFiscal = useMutation({
    mutationFn: saveCompanyFiscal,
    onSuccess: async () => {
      setMsg("Fiscal do emitente salvo!");
      await qc.invalidateQueries({ queryKey: ["company-fiscal"] });
    },
    onError: (e: any) => setMsg(e?.message ?? "Erro"),
  });

  if (q.isLoading || qFiscal.isLoading) return <div className="p-6">Carregando...</div>;
  if (q.isError) return <div className="p-6 text-red-600">Erro: {(q.error as any)?.message ?? "Falha"}</div>;
  if (qFiscal.isError) return <div className="p-6 text-red-600">Erro: {(qFiscal.error as any)?.message ?? "Falha"}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configurações · Empresa & Fiscal</h1>
        <Button asChild variant="outline"><Link href="/configuracoes">Voltar</Link></Button>
      </div>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}

      <Card>
        <CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Nome da empresa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="CNPJ" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Base Fiscal (pré emissor)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Regime (ex: SIMPLES)" value={form.regime} onChange={(e) => setForm({ ...form, regime: e.target.value })} />
          <Input placeholder="Certificado (serial/identificador)" value={form.certSerial} onChange={(e) => setForm({ ...form, certSerial: e.target.value })} />
          <div className="md:col-span-2 text-xs text-muted-foreground">
            Aqui é só a base (empresa/fiscal). Amanhã a gente cria Produtos Fiscal (NCM/CFOP/CST) + busca de NCM.
          </div>
          <div className="md:col-span-2">
            <Button disabled={mut.isPending} onClick={() => mut.mutate(form)}>
              {mut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Emitente (Fiscal obrigatório p/ NF-e/NFC-e)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Razão social" value={fiscal.legalName} onChange={(e) => setFiscal({ ...fiscal, legalName: e.target.value })} />
          <Input placeholder="Nome fantasia" value={fiscal.tradeName} onChange={(e) => setFiscal({ ...fiscal, tradeName: e.target.value })} />
          <Input placeholder="IE (Inscrição Estadual)" value={fiscal.ie} onChange={(e) => setFiscal({ ...fiscal, ie: e.target.value })} />
          <Input placeholder="CRT (1=Simples,2=Excesso,3=Normal)" value={fiscal.crt} onChange={(e) => setFiscal({ ...fiscal, crt: e.target.value })} />

          <Input placeholder="Logradouro" value={fiscal.addressStreet} onChange={(e) => setFiscal({ ...fiscal, addressStreet: e.target.value })} />
          <Input placeholder="Número" value={fiscal.addressNumber} onChange={(e) => setFiscal({ ...fiscal, addressNumber: e.target.value })} />
          <Input placeholder="Bairro" value={fiscal.addressDistrict} onChange={(e) => setFiscal({ ...fiscal, addressDistrict: e.target.value })} />
          <Input placeholder="Cidade" value={fiscal.addressCity} onChange={(e) => setFiscal({ ...fiscal, addressCity: e.target.value })} />
          <Input placeholder="UF" value={fiscal.addressState} onChange={(e) => setFiscal({ ...fiscal, addressState: e.target.value })} />
          <Input placeholder="CEP" value={fiscal.addressZip} onChange={(e) => setFiscal({ ...fiscal, addressZip: e.target.value })} />
          <Input placeholder="cMun (IBGE do município)" value={fiscal.cityCodeIbge} onChange={(e) => setFiscal({ ...fiscal, cityCodeIbge: e.target.value })} />

          <div className="md:col-span-2 text-xs text-muted-foreground">
            Esses campos serão exigidos por qualquer emissor real. Sem eles, a emissão deve ser bloqueada.
          </div>
          <div className="md:col-span-2">
            <Button disabled={mutFiscal.isPending} onClick={() => mutFiscal.mutate({ ...fiscal, crt: fiscal.crt ? Number(fiscal.crt) : null })}>
              {mutFiscal.isPending ? "Salvando..." : "Salvar emitente fiscal"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
