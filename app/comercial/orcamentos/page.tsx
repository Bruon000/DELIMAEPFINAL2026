"use client";

import Link from "next/link";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";

export default function ComercialOrcamentosPage() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Comercial - Orçamentos"
        subtitle="Entrada do funil do vendedor (propostas/orçamentos)."
        actions={
          <Link href="/orcamentos">
            <Button>Ir para Orçamentos</Button>
          </Link>
        }
      />

      <div className="text-sm text-muted-foreground">
        Próximo passo: fluxo completo de orçamento (versões, aprovação e conversão em pedido).
      </div>
    </div>
  );
}