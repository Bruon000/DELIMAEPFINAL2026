import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ConfiguracoesPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="border rounded p-4 space-y-2">
          <div className="font-medium">Empresa & Fiscal</div>
          <div className="text-sm text-muted-foreground">Dados da empresa + base fiscal (pré emissor).</div>
          <Button asChild variant="outline"><Link href="/configuracoes/empresa">Abrir</Link></Button>
        </div>
        <div className="border rounded p-4 space-y-2">
          <div className="font-medium">Config Fiscal (emissor)</div>
          <div className="text-sm text-muted-foreground">Provider e token do emissor (MOCK, Nuvem Fiscal, etc.).</div>
          <Button asChild variant="outline"><Link href="/configuracoes/fiscal">Abrir</Link></Button>
        </div>
        <div className="border rounded p-4 space-y-2">
          <div className="font-medium">Preços (Premium)</div>
          <div className="text-sm text-muted-foreground">Defina regra de sugestão (margem/markup/arredondamento).</div>
          <Button asChild variant="outline"><Link href="/configuracoes/precos">Abrir</Link></Button>
        </div>
      </div>
    </div>
  );
}
