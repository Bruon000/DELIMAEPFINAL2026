"use client";

import Link from "next/link";
import { Bell, Search, Plus, Hammer, BadgeDollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TopbarProps {
  title?: string;
  actions?: React.ReactNode;
}

export function Topbar({ title = "Dashboard", actions }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <h1 className="text-lg font-semibold">{title}</h1>

      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="relative hidden w-72 md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" aria-label="Busca global" />
        </div>

        {/* Ações rápidas */}
        <Button asChild variant="default" size="sm" className="gap-1">
          <Link href="/comercial/pedidos/novo">
            <Plus className="h-4 w-4" />
            Novo pedido
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link href="/producao/ops">
            <Hammer className="h-4 w-4" />
            Nova OP
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-1">
          <Link href="/financeiro/contas-receber">
            <BadgeDollarSign className="h-4 w-4" />
            Receber
          </Link>
        </Button>

        {actions}

        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
