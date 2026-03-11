import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfiguracoesPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Central de parâmetros da empresa, emissão fiscal e regras operacionais do ERP.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Empresa & Fiscal</CardTitle>
                <Badge variant="default">Base do emitente</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Configure dados da empresa, emitente fiscal, endereço e preparação para emissão de NF-e / NFC-e.
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Ideal para revisar CNPJ, razão social, IE, CRT e endereço do emitente.
              </div>
              <Button asChild variant="outline">
                <Link href="/configuracoes/empresa">Abrir</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Config Fiscal</CardTitle>
                <Badge variant="secondary">Integração</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Provider, token, base URL e webhook do emissor fiscal plugável.
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Área mais técnica, pensada para integração com MOCK, Nuvem Fiscal, Tecnospeed e similares.
              </div>
              <Button asChild variant="outline">
                <Link href="/configuracoes/fiscal">Abrir</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-sm md:col-span-2">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Preços (Premium)</CardTitle>
                <Badge variant="outline">Comercial</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Defina regras de sugestão de preço com margem, markup, arredondamento e base de precificação.
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Use essa área para padronizar preço sugerido, operação comercial e política de rentabilidade.
              </div>
              <Button asChild variant="outline">
                <Link href="/configuracoes/precos">Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Visão geral</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border px-3 py-2">1. <b>Empresa & Fiscal</b> organiza a base cadastral do emitente.</div>
              <div className="rounded-lg border px-3 py-2">2. <b>Config Fiscal</b> conecta o ERP ao provider de emissão.</div>
              <div className="rounded-lg border px-3 py-2">3. <b>Preços</b> padroniza regras comerciais e sugestão de venda.</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Expansão futura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border bg-muted/30 p-3">
                A estrutura já está sendo preparada para crescer com recursos como:
              </div>
              <div className="rounded-lg border px-3 py-2">• Filiais e emitente por unidade</div>
              <div className="rounded-lg border px-3 py-2">• Séries fiscais separadas</div>
              <div className="rounded-lg border px-3 py-2">• Permissões por operação</div>
              <div className="rounded-lg border px-3 py-2">• Integrações fiscais por ambiente</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
