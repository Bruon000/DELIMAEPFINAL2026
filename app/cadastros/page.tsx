import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CadastrosPage() {
  const links = [
    
    { title: "Fornecedores", href: "/cadastros/fornecedores", desc: "CRUD + CNPJ (auto preencher)" },
{ title: "Clientes", href: "/clientes", desc: "CRUD completo" },
    { title: "Produtos", href: "/cadastros/produtos", desc: "CRUD + BOM por produto" },
    { title: "Materiais", href: "/cadastros/materiais", desc: "CRUD + gera StockItem" },
    { title: "Unidades", href: "/cadastros/unidades", desc: "CRUD de unidades (un, m, kg, l...)" },
    { title: "Estoque (visão)", href: "/estoque", desc: "Saldo e reservado" },
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Cadastros</h1>
      <p className="text-muted-foreground">Acesso rápido aos cadastros principais.</p>

      <div className="grid gap-3 md:grid-cols-2">
        {links.map((l) => (
          <Card key={l.href}>
            <CardHeader><CardTitle>{l.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{l.desc}</p>
              <Button asChild>
                <Link href={l.href}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}



