"use client";

import Link from "next/link";
import { PageHeader } from "@/components/erp/page-header";
import { Button } from "@/components/ui/button";

export default function ComercialClientesPage() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Comercial - Clientes"
        subtitle="Atalho do vendedor para o cadastro de clientes."
        actions={
          <Link href="/clientes">
            <Button>Ir para Clientes</Button>
          </Link>
        }
      />

      <div className="text-sm text-muted-foreground">
        Aqui vamos evoluir para histórico completo (propostas, pedidos e pós-venda). Por enquanto, usamos o módulo principal de Clientes.
      </div>
    </div>
  );
}