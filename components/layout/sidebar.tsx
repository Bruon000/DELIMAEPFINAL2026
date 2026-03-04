"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Package,
  Wallet,
  FileText,
  Bot,
  ChevronLeft,
  ChevronRight,
  Settings,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMobile } from "@/hooks/use-mobile";
import { useSidebar } from "./sidebar-context";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: { title: string; href: string }[];
}

const mainNav: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },

  {
    title: "Comercial",
    href: "/comercial",
    icon: ShoppingCart,
    children: [
      { title: "Pedidos", href: "/pedidos" },
      { title: "Orçamentos", href: "/orcamentos" },
    ],
  },

  {
    title: "Produção",
    href: "/producao",
    icon: Factory,
    children: [
      { title: "Ordens de Produção", href: "/producao/ops" },
      { title: "Apontamentos", href: "/producao/apontamentos" },
    ],
  },

  {
    title: "Estoque",
    href: "/estoque",
    icon: Package,
    children: [
      { title: "Materiais", href: "/estoque/materiais" },
      { title: "Entradas", href: "/estoque/entradas" },
      { title: "Movimentações", href: "/estoque/movimentacoes" },
      { title: "Reservas (por material)", href: "/estoque/reservas" },
      { title: "Reservas (por pedido)", href: "/estoque/reservas-origem" },
      { title: "Crítico", href: "/estoque/critico" },
    ],
  },

  {
    title: "Financeiro",
    href: "/financeiro",
    icon: Wallet,
    children: [
      { title: "Contas a Receber", href: "/financeiro/contas-receber" },
      { title: "Caixa", href: "/financeiro/caixa" },
      { title: "Contas a Pagar", href: "/financeiro/contas-pagar" },
    ],
  },

  {
    title: "Fiscal",
    href: "/fiscal",
    icon: FileText,
    children: [{ title: "Notas Fiscais", href: "/fiscal/notas" }],
  },

  { title: "IA Copilot", href: "/copilot", icon: Bot },
];

const bottomNav: NavItem[] = [
  {
    title: "Cadastros",
    href: "/cadastros",
    icon: Boxes,
    children: [
      { title: "Clientes", href: "/clientes" },
      { title: "Produtos", href: "/cadastros/produtos" },
      { title: "Materiais", href: "/cadastros/materiais" },
      { title: "Fornecedores", href: "/cadastros/fornecedores" },
    ],
  },
  { title: "Configurações", href: "/configuracoes", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const isMobile = useMobile();
  const { collapsed, setCollapsed } = useSidebar();

  const [expandedModules, setExpandedModules] = React.useState<string[]>([
    "Comercial",
    "Produção",
    "Estoque",
    "Financeiro",
    "Cadastros",
  ]);

  const toggleModule = (title: string) => {
    setExpandedModules((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const sidebarWidth = collapsed ? (isMobile ? 0 : 64) : 260;

  const renderItem = (item: NavItem) => {
    if (item.children?.length) {
      return (
        <div key={item.href}>
          <button
            onClick={() => toggleModule(item.title)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{item.title}</span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform",
                    expandedModules.includes(item.title) && "rotate-90"
                  )}
                />
              </>
            )}
          </button>

          {!collapsed &&
            expandedModules.includes(item.title) &&
            item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 pl-9 text-sm transition-colors",
                  isActive(child.href)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {child.title}
              </Link>
            ))}
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive(item.href)
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.title}</span>}
      </Link>
    );
  };

  return (
    <>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r bg-card transition-[width] duration-200 ease-in-out",
          isMobile && collapsed && "w-0 border-0 overflow-hidden"
        )}
        style={{ width: isMobile && collapsed ? 0 : sidebarWidth }}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b px-4">
            {!collapsed && (
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <Factory className="h-6 w-6 text-primary" />
                <span className="text-sm">ERP Serralheria</span>
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {mainNav.map(renderItem)}

            <Separator className="my-2" />

            {bottomNav.map(renderItem)}
          </nav>
        </div>
      </aside>
    </>
  );
}




