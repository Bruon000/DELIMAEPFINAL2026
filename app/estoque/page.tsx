import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export default async function EstoquePage() {
  const session = await getSession();
  const companyId = session?.user?.companyId as string | undefined;

  if (!companyId) {
    return <div className="p-6">Não autenticado.</div>;
  }

  const items = await prisma.stockItem.findMany({
    include: {
      material: { select: { id: true, name: true, code: true, minStock: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  return (
    <div className="p-6 space-y-2">
      <h1 className="text-2xl font-bold">Estoque</h1>
      <div className="text-sm text-muted-foreground">Visão rápida (quantidade e reservado).</div>

      <div className="space-y-2 mt-4">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between border rounded p-3">
            <div>
              <div className="font-medium">{it.material.code ? `${it.material.code} - ` : ""}{it.material.name}</div>
              <div className="text-sm text-muted-foreground">Min: {it.material.minStock != null ? Number(it.material.minStock) : "-"} </div>
            </div>
            <div className="text-sm text-muted-foreground">
              Qtd: {Number(it.quantity).toFixed(4)} · Reservado: {Number(it.reserved).toFixed(4)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
