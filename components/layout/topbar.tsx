"use client";

import * as React from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TopbarProps {
  title?: string;
  actions?: React.ReactNode;
}

type SearchItem = {
  type: "client" | "product" | "order" | "op";
  title: string;
  href: string;
  meta?: string | null;
};

export function Topbar({ title = "Dashboard", actions }: TopbarProps) {
  const { data: session } = useSession();
  const role = String((session as any)?.user?.role ?? "");
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<SearchItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const qq = q.trim();
    if (qq.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(qq)}`);
        const data = await res.json();
        setItems(data.results ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <h1 className="text-lg font-semibold">{title}</h1>

      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="relative hidden w-72 md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-9"
            aria-label="Busca global"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />

          {open && (loading || items.length > 0) && (
            <div className="absolute right-0 mt-2 w-full rounded-md border bg-background shadow-lg">
              <div className="p-2 text-xs text-muted-foreground">
                {loading ? "Buscando..." : `Resultados: ${items.length}`}
              </div>
              <div className="max-h-72 overflow-auto">
                {items.map((it, idx) => (
                  <Link
                    key={idx}
                    href={it.href}
                    className="block px-3 py-2 text-sm hover:bg-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span>{it.title}</span>
                      <span className="text-xs text-muted-foreground">{it.type.toUpperCase()}</span>
                    </div>
                  </Link>
                ))}
                {!loading && items.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nada encontrado.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {role === "VENDEDOR" ? (
          <>
            <Button asChild size="sm">
              <Link href="/comercial/venda">Iniciar venda</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/pedidos/novo">Novo pedido</Link>
            </Button>
          </>
        ) : null}

        {(role === "ADMIN" || role === "PRODUCAO") ? (
          <Button asChild variant="secondary" size="sm">
            <Link href="/producao/ops">Nova OP</Link>
          </Button>
        ) : null}

        {(role === "CAIXA" || role === "ADMIN" || role === "CONTADOR") ? (
          <Button asChild variant="secondary" size="sm">
            <Link href="/financeiro/caixa">Receber</Link>
          </Button>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sair
        </Button>

        {actions}

        <Button variant="ghost" size="icon" aria-label="Notificações">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
