"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runProviderTest, type ProviderTestResponse } from "@/lib/fiscal/provider-test";

type CertificateInfo = {
  ok: boolean;
  commonName: string;
  serialNumber: string;
  validFrom: string | null;
  validTo: string | null;
  isExpired: boolean;
  daysRemaining: number | null;
  cnpj: string;
  subjectSummary: string;
  warnings: string[];
  error?: string;
};

type FetchResponse = {
  config: {
    environment: string;
    provider: string;
    providerToken: string;
    providerBaseUrl: string;
    webhookSecret: string;
    certificateType: string;
    certificatePfxBase64: string;
    certificatePassword: string;
    csc: string;
    cscId: string;
    certificateUpdatedAt: string | null;
  };
  readiness: {
    ok: boolean;
    pending: string[];
  };
  certificateInfo: CertificateInfo | null;
};

type FiscalTestResponse = {
  ok: boolean;
  stage: string;
  message: string;
  company?: {
    id: string | null;
    name: string | null;
    document: string | null;
  };
  candidateOrder?: {
    id: string;
    number: string | null;
    total: number | string | null;
    confirmedAt: string | null;
    clientName: string | null;
  };
  provider?: {
    selected: string;
    implemented: boolean;
  };
  docType?: string;
  emitentePending?: string[];
  configPending?: string[];
  missingClient?: string[];
  missingItems?: Array<{
    itemId: string;
    productId: string;
    productName: string | null;
    missing: string[];
  }>;
  warnings?: string[];
  payloadPreview?: unknown;
};

async function fetchConfig(): Promise<FetchResponse> {
  const res = await fetch("/api/fiscal/config");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? "Erro ao carregar config fiscal");
  return data;
}

async function saveConfig(payload: any): Promise<FetchResponse> {
  const res = await fetch("/api/fiscal/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const extra =
      data?.certificateInfo?.error ||
      data?.message ||
      data?.error ||
      "Erro ao salvar config fiscal";
    throw new Error(extra);
  }
  return data;
}

async function runFiscalTest(payload?: { orderId?: string; docType?: string }): Promise<FiscalTestResponse> {
  const res = await fetch("/api/fiscal/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && !data) {
    throw new Error("Erro ao testar configuração fiscal.");
  }
  return data as FiscalTestResponse;
}

function maskCscId(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

function buildPending(config: any, readiness: any) {
  const pending = Array.isArray(readiness?.pending) ? [...readiness.pending] : [];

  if (!config?.environment) pending.push("Ambiente fiscal");
  if (!config?.provider) pending.push("Provider fiscal");
  if (config?.provider !== "MOCK" && !config?.providerToken) pending.push("Token/API key do provider");
  if (config?.provider !== "MOCK" && !config?.certificatePfxBase64) pending.push("Arquivo do certificado PFX/P12");
  if (config?.provider !== "MOCK" && !config?.certificatePassword) pending.push("Senha do certificado");
  if (!config?.csc) pending.push("CSC");
  if (!config?.cscId) pending.push("ID CSC");

  return Array.from(new Set(pending));
}

async function fileToBase64(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export default function ConfigFiscalPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["fiscal-config"], queryFn: fetchConfig });

  const [environment, setEnvironment] = React.useState("HOMOLOG");
  const [provider, setProvider] = React.useState("MOCK");
  const [providerToken, setProviderToken] = React.useState("");
  const [providerBaseUrl, setProviderBaseUrl] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");
  const [certificateType, setCertificateType] = React.useState("A1");
  const [certificatePfxBase64, setCertificatePfxBase64] = React.useState("");
  const [certificatePassword, setCertificatePassword] = React.useState("");
  const [csc, setCsc] = React.useState("");
  const [cscId, setCscId] = React.useState("");
  const [certificateFileName, setCertificateFileName] = React.useState("");
  const [showRawBase64, setShowRawBase64] = React.useState(false);
  const [testResult, setTestResult] = React.useState<FiscalTestResponse | null>(null);
  const [providerTestResult, setProviderTestResult] = React.useState<ProviderTestResponse | null>(null);
  const [testOrderId, setTestOrderId] = React.useState("");
  const [testDocType, setTestDocType] = React.useState("");

  React.useEffect(() => {
    const config = q.data?.config;
    if (!config) return;
    setEnvironment(String(config.environment ?? "HOMOLOG"));
    setProvider(String(config.provider ?? "MOCK"));
    setProviderToken(String(config.providerToken ?? ""));
    setProviderBaseUrl(String(config.providerBaseUrl ?? ""));
    setWebhookSecret(String(config.webhookSecret ?? ""));
    setCertificateType(String(config.certificateType ?? "A1"));
    setCertificatePfxBase64(String(config.certificatePfxBase64 ?? ""));
    setCertificatePassword(String(config.certificatePassword ?? ""));
    setCsc(String(config.csc ?? ""));
    setCscId(String(config.cscId ?? ""));
  }, [q.data]);

  const mut = useMutation({
    mutationFn: () =>
      saveConfig({
        environment,
        provider,
        providerToken,
        providerBaseUrl,
        webhookSecret,
        certificateType,
        certificatePfxBase64,
        certificatePassword,
        csc,
        cscId,
      }),
    onSuccess: async (data) => {
      toast.success("Configuração fiscal salva.");
      if (data?.certificateInfo?.warnings?.length) {
        toast.warning(data.certificateInfo.warnings.join(" | "));
      }
      if (Array.isArray(data?.readiness?.pending) && data.readiness.pending.length > 0) {
        toast.warning(`Ainda existem pendências fiscais: ${data.readiness.pending.length}`);
      }
      await qc.invalidateQueries({ queryKey: ["fiscal-config"] });
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const testMut = useMutation({
    mutationFn: () =>
      runFiscalTest({
        orderId: testOrderId.trim() || undefined,
        docType: testDocType.trim() || undefined,
      }),
    onSuccess: (data) => {
      setTestResult(data);
      if (data.ok) {
        toast.success(data.message || "Teste fiscal concluído.");
      } else {
        toast.warning(data.message || "O teste encontrou pendências.");
      }
      if (data.warnings?.length) {
        toast.warning(data.warnings.join(" | "));
      }
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao testar configuração fiscal"),
  });

  const providerTestMut = useMutation({
    mutationFn: () => runProviderTest(),
    onSuccess: (data) => {
      setProviderTestResult(data);
      if (data.ok) {
        toast.success(data.message || "Teste do provider concluído.");
      } else {
        toast.error(data.message || "Falha ao testar provider.");
      }
    },
    onError: (e: Error) => toast.error(e?.message ?? "Erro ao testar provider"),
  });

  async function handleCertificateFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pfx") && !lower.endsWith(".p12")) {
      toast.error("Selecione um arquivo .pfx ou .p12.");
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setCertificatePfxBase64(base64);
      setCertificateFileName(file.name);
      toast.success("Arquivo do certificado carregado. Agora informe a senha e salve para validar.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler o arquivo.");
    }
  }

  const pending = buildPending(
    {
      environment,
      provider,
      providerToken,
      providerBaseUrl,
      webhookSecret,
      certificateType,
      certificatePfxBase64,
      certificatePassword,
      csc,
      cscId,
    },
    q.data?.readiness
  );

  const cert = q.data?.certificateInfo ?? null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Configurações Fiscal</h1>
          <p className="text-sm text-muted-foreground">
            Ambiente, provider, certificado A1/PFX e CSC para operação real de NF-e/NFC-e.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/configuracoes">Voltar</Link>
        </Button>
      </div>

      <Card className={pending.length === 0 ? "border-green-500" : "border-amber-500"}>
        <CardHeader>
          <CardTitle>Checklist de prontidão fiscal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            Status:{" "}
            <span className={pending.length === 0 ? "font-semibold text-green-600" : "font-semibold text-amber-600"}>
              {pending.length === 0 ? "Pronto para operação" : "Configuração incompleta"}
            </span>
          </div>

          {pending.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {pending.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Emitente, provider, certificado e CSC estão consistentes. Faça o teste ponta a ponta em homologação antes de produção.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ambiente e emissor fiscal</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Ambiente *</label>
            <select
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            >
              <option value="HOMOLOG">Homologação</option>
              <option value="PROD">Produção</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Provider *</label>
            <select
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="MOCK">MOCK (somente testes locais)</option>
              <option value="NUVEMFISCAL">Nuvem Fiscal</option>
              <option value="TECNOSPEED">Tecnospeed</option>
              <option value="FOCUSNFE">Focus NFe</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Token / API Key *</label>
            <Input
              value={providerToken}
              onChange={(e) => setProviderToken(e.target.value)}
              placeholder="Cole aqui o token do emissor"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL do provider</label>
            <Input
              value={providerBaseUrl}
              onChange={(e) => setProviderBaseUrl(e.target.value)}
              placeholder="https://api.do-emissor.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Webhook secret</label>
            <Input
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Segredo para validar callbacks"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certificado digital</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo do certificado *</label>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={certificateType}
                onChange={(e) => setCertificateType(e.target.value)}
              >
                <option value="A1">A1</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Senha do certificado *</label>
              <Input
                type="password"
                value={certificatePassword}
                onChange={(e) => setCertificatePassword(e.target.value)}
                placeholder="Senha do PFX/P12"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <label className="text-sm font-medium">Arquivo do certificado PFX/P12 *</label>
              <Input type="file" accept=".pfx,.p12,application/x-pkcs12" onChange={handleCertificateFileChange} />
              <p className="text-xs text-muted-foreground">
                Arquivo atual: {certificateFileName || (certificatePfxBase64 ? "carregado no sistema" : "nenhum arquivo selecionado")}
              </p>
            </div>

            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={() => setShowRawBase64((v) => !v)}>
                {showRawBase64 ? "Ocultar base64" : "Mostrar base64"}
              </Button>
            </div>
          </div>

          {showRawBase64 ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Conteúdo base64 do PFX/P12</label>
              <textarea
                className="min-h-[180px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={certificatePfxBase64}
                onChange={(e) => setCertificatePfxBase64(e.target.value)}
                placeholder="Conteúdo base64 do certificado"
              />
            </div>
          ) : null}

          <div className={`rounded-md border p-4 ${cert?.ok ? "border-green-500" : "border-amber-500"}`}>
            <div className="mb-2 text-sm font-medium">Diagnóstico do certificado</div>

            {!cert ? (
              <p className="text-sm text-muted-foreground">
                Carregue o arquivo, informe a senha e salve para validar o certificado.
              </p>
            ) : cert.ok ? (
              <div className="space-y-2 text-sm">
                <div>
                  Status:{" "}
                  <span className={cert.isExpired ? "font-semibold text-red-600" : "font-semibold text-green-600"}>
                    {cert.isExpired ? "Expirado" : "Válido"}
                  </span>
                </div>
                <div><strong>Titular / CN:</strong> {cert.commonName || "—"}</div>
                <div><strong>CNPJ encontrado:</strong> {cert.cnpj || "não identificado"}</div>
                <div><strong>Número de série:</strong> {cert.serialNumber || "—"}</div>
                <div><strong>Válido de:</strong> {formatDateTime(cert.validFrom)}</div>
                <div><strong>Válido até:</strong> {formatDateTime(cert.validTo)}</div>
                <div><strong>Dias restantes:</strong> {cert.daysRemaining ?? "—"}</div>

                {cert.warnings?.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-amber-700">
                    {cert.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="font-semibold text-red-600">Certificado inválido</div>
                <div>{cert.error || "Não foi possível validar o certificado."}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teste técnico de homologação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pedido para teste</label>
              <Input
                value={testOrderId}
                onChange={(e) => setTestOrderId(e.target.value)}
                placeholder="Opcional. Se vazio, usa o último pedido pago."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de documento</label>
              <select
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={testDocType}
                onChange={(e) => setTestDocType(e.target.value)}
              >
                <option value="">Automático</option>
                <option value="NFE">NF-e</option>
                <option value="NFCE">NFC-e</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => testMut.mutate()} disabled={testMut.isPending}>
              {testMut.isPending ? "Testando..." : "Testar configuração fiscal"}
            </Button>
          </div>

          {testResult ? (
            <div className={`rounded-md border p-4 ${testResult.ok ? "border-green-500" : "border-amber-500"}`}>
              <div className="mb-2 text-sm font-medium">Resultado do teste</div>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Status:</strong>{" "}
                  <span className={testResult.ok ? "font-semibold text-green-600" : "font-semibold text-amber-600"}>
                    {testResult.ok ? "Pronto para teste técnico no provider" : "Pendências encontradas"}
                  </span>
                </div>
                <div><strong>Mensagem:</strong> {testResult.message}</div>
                <div><strong>Provider:</strong> {testResult.provider?.selected ?? "—"}</div>
                <div><strong>Tipo sugerido/usado:</strong> {testResult.docType ?? "—"}</div>
                <div><strong>Pedido candidato:</strong> {testResult.candidateOrder?.number ?? testResult.candidateOrder?.id ?? "—"}</div>

                {testResult.emitentePending?.length ? (
                  <div>
                    <div className="font-medium">Pendências do emitente</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {testResult.emitentePending.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {testResult.configPending?.length ? (
                  <div>
                    <div className="font-medium">Pendências da configuração</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {testResult.configPending.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {testResult.missingClient?.length ? (
                  <div>
                    <div className="font-medium">Pendências do cliente</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {testResult.missingClient.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {testResult.missingItems?.length ? (
                  <div>
                    <div className="font-medium">Itens com cadastro fiscal incompleto</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {testResult.missingItems.map((item) => (
                        <li key={item.itemId}>
                          {item.productName || item.productId}: {item.missing.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {testResult.warnings?.length ? (
                  <div>
                    <div className="font-medium">Avisos</div>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {testResult.warnings.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teste externo · Nuvem Fiscal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            Este teste sincroniza empresa, certificado A1, configuração de NF-e/NFC-e e consulta o status da SEFAZ no provider real.
            Ele ainda não emite a nota; o próximo passo é mapear o payload interno para os endpoints de emissão.
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => providerTestMut.mutate()}
              disabled={providerTestMut.isPending}
            >
              {providerTestMut.isPending ? "Testando provider..." : "Testar Nuvem Fiscal"}
            </Button>
          </div>

          {providerTestResult ? (
            <div className={`rounded-md border p-4 ${providerTestResult.ok ? "border-green-500" : "border-red-500"}`}>
              <div className="mb-2 text-sm font-medium">Resultado do provider</div>

              <div className="space-y-2 text-sm">
                <div>
                  <strong>Status:</strong>{" "}
                  <span className={providerTestResult.ok ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                    {providerTestResult.ok ? "Provider conectado" : "Falha no setup externo"}
                  </span>
                </div>

                <div><strong>Mensagem:</strong> {providerTestResult.message}</div>

                {providerTestResult.result ? (
                  <>
                    <div><strong>Ambiente:</strong> {providerTestResult.result.ambiente}</div>
                    <div><strong>CNPJ:</strong> {providerTestResult.result.companyCnpj}</div>
                    <div><strong>Base URL:</strong> {providerTestResult.result.providerBaseUrl}</div>
                  </>
                ) : null}

                {providerTestResult.notes?.length ? (
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {providerTestResult.notes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}

                {!providerTestResult.ok && providerTestResult.detail ? (
                  <pre className="overflow-auto rounded-md border bg-muted p-3 text-xs">
                    {JSON.stringify(providerTestResult.detail, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-muted">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Consultar status, baixar XML/PDF e cancelar documentos fiscais estão em{" "}
            <Link href="/fiscal/documentos" className="underline font-medium text-foreground">
              Fiscal → Documentos
            </Link>
            . Abra um documento na lista para usar essas ações.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>NFC-e · CSC / QR Code</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">CSC *</label>
            <Input value={csc} onChange={(e) => setCsc(e.target.value)} placeholder="Código de Segurança do Contribuinte" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">ID CSC *</label>
            <Input value={cscId} onChange={(e) => setCscId(maskCscId(e.target.value))} placeholder="Ex.: 1" />
          </div>

          <div className="space-y-2">
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              Mantenha CSC e ID CSC válidos para o ambiente em uso. Homologação e produção podem ter credenciais diferentes.
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Salvando..." : "Salvar configuração fiscal"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
