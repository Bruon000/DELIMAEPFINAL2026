"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { PageHeader } from "@/components/erp/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ImportResult = {
  ok?: boolean;
  message?: string;
  purchaseOrderId?: string;
  purchaseOrder?: { id?: string };
  created?: boolean;
  deduped?: boolean;
  nfeKey?: string;
  warnings?: string[];
  itemsCount?: number;
};

async function importNFeXML(xml: string, filename?: string): Promise<ImportResult> {
  const res = await fetch("/api/fiscal/nfe/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xml, filename }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Erro específico de dedupe sem PO vinculado
    if (res.status === 409 && data?.error === "dedupe_missing_purchase_order") {
      throw new Error(data?.message ?? "NF-e já importada, mas PO não encontrado.");
    }
    // fallback padrão
    throw new Error(data?.message ?? data?.error ?? "Falha ao importar NF-e");
  }
  return data as ImportResult;
}

export default function ImportarNFePage() {
  const router = useRouter();
  const [file, setFile] = React.useState<File | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [preview, setPreview] = React.useState<string>("");

  const MAX_BYTES = 5 * 1024 * 1024; // 5MB

  const setFileSafe = async (f: File | null) => {
    setResult(null);
    setPreview("");

    if (!f) {
      setFile(null);
      return;
    }

    const name = (f.name ?? "").toLowerCase();
    const isXml = name.endsWith(".xml") || f.type.includes("xml");
    if (!isXml) {
      toast.error("Arquivo inválido. Selecione um XML (.xml).");
      setFile(null);
      return;
    }

    if (f.size > MAX_BYTES) {
      toast.error("Arquivo muito grande. Limite: 5MB.");
      setFile(null);
      return;
    }

    const text = await f.text();
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("XML vazio.");
      setFile(null);
      return;
    }

    // Preview das primeiras ~25 linhas (só pra conferência)
    const lines = trimmed.split(/\r?\n/).slice(0, 25).join("\n");
    setPreview(lines);
    setFile(new File([text], f.name, { type: f.type || "text/xml" }));
  };

  const resetAll = () => {
    setFile(null);
    setResult(null);
    setPreview("");
    toast.info("Pronto para importar outra NF-e.");
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0] ?? null;
    await setFileSafe(f);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const poId =
    result?.purchaseOrderId ??
    result?.purchaseOrder?.id ??
    undefined;

  const onImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo XML primeiro.");
      return;
    }

    setIsBusy(true);
    setResult(null);
    try {
      const xml = await file.text();
      if (!xml.trim()) {
        toast.error("XML vazio.");
        return;
      }
      const data = await importNFeXML(xml, file.name);
      setResult(data);

      const createdPoId = data?.purchaseOrderId ?? data?.purchaseOrder?.id;
      if (createdPoId) {
        if (data?.deduped) {
          toast.info(`NF-e já importada. Abrindo pedido #${createdPoId}…`);
        } else if (data?.created) {
          toast.success("NF-e importada. Pedido de compra criado!");
        } else {
          toast.success("NF-e processada. Abrindo pedido…");
        }

        router.push(`/compras/pedidos/${createdPoId}`);
        return;
      }

      const msg =
        data?.message ??
        (data?.deduped
          ? "NF-e já importada (dedupe)."
          : "NF-e importada com sucesso.");

      toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao importar NF-e");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Importar NF-e (XML)"
        subtitle="Importa XML de NF-e e cria/atualiza um Pedido de Compra (PO) automaticamente."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/compras/pedidos">Voltar para Compras</Link>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={resetAll}
              disabled={isBusy}
            >
              Importar outra
            </Button>
            <Button onClick={onImport} disabled={!file || isBusy}>
              {isBusy ? "Importando..." : "Importar"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Arquivo XML</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            className="rounded-md border border-dashed p-4"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-md border p-2">
                <Upload className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  Arraste e solte o XML aqui
                </div>
                <div className="text-xs text-muted-foreground">
                  ou selecione no botão abaixo (máx. 5MB)
                </div>
              </div>
            </div>

            <div className="mt-3">
              <Input
                type="file"
                accept=".xml,text/xml,application/xml"
                onChange={async (e) => {
                  const f = e.target.files?.[0] ?? null;
                  await setFileSafe(f);
                }}
              />
            </div>
          </div>

          {file ? (
            <div className="text-xs text-muted-foreground">
              Selecionado: <span className="font-medium text-foreground">{file.name}</span>{" "}
              · {(file.size / 1024).toFixed(1)} KB
            </div>
          ) : null}

          {preview ? (
            <div className="rounded-md border p-3">
              <div className="text-sm font-medium">Preview do XML</div>
              <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
                {preview}
              </pre>
            </div>
          ) : null}

          <div className="text-xs text-muted-foreground">
            Dica: se a nota já tiver sido importada, o backend deve deduplicar pela chave da NF-e.
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.nfeKey ? (
              <div className="text-sm">
                <span className="text-muted-foreground">Chave NF-e:</span>{" "}
                <span className="font-mono">{result.nfeKey}</span>
              </div>
            ) : null}

            <div className="text-sm">
              <span className="text-muted-foreground">Status:</span>{" "}
              <span className="font-medium">
                {result.deduped ? "Deduplicada" : result.created ? "Criada" : "Processada"}
              </span>
            </div>

            {typeof result.itemsCount === "number" ? (
              <div className="text-sm">
                <span className="text-muted-foreground">Itens detectados:</span>{" "}
                <span className="font-medium">{result.itemsCount}</span>
              </div>
            ) : null}

            {result.message ? (
              <div className="text-sm">{result.message}</div>
            ) : null}

            {poId ? (
              <div className="pt-2">
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/compras/pedidos/${poId}`}>Abrir Pedido de Compra</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/compras/pedidos">Voltar para Compras</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetAll}
                    disabled={isBusy}
                  >
                    Importar outra
                  </Button>
                </div>
              </div>
            ) : null}

            {result.warnings?.length ? (
              <div className="rounded-md border p-3">
                <div className="text-sm font-medium">Avisos</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                  {result.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
