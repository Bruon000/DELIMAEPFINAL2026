import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

type Row = {
  orderId: string;
  orderNumber: string | null;
  orderStatus: string;
  materialId: string;
  reservedNeed: number;
  material?: { id: string; name: string; code: string | null } | null;
};

/**
 * Reservas por origem (Pedido):
 * - Não temos tabela de alocação por pedido, então calculamos o "need" por BOM dos pedidos ativos.
 * - Útil para responder: "quem está consumindo/segurando reserva?"
 *
 * Query:
 * - q: busca em número do pedido, material name/code
 * - take: 1..200 (default 80)
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  const companyId = session.user.companyId as string;

  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") ?? "").trim().toLowerCase();
  const takeRaw = Number(url.searchParams.get("take") ?? 80);
  const take = Math.min(Math.max(Number.isFinite(takeRaw) ? takeRaw : 80, 1), 200);

  // Pedidos que ainda fazem sentido "segurar" reserva (ajuste se quiser)
  const activeStatuses = ["CONFIRMED", "IN_PRODUCTION", "READY", "INSTALLED"];

  const orders = await prisma.order.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: { in: activeStatuses as any },
    } as any,
    orderBy: { createdAt: "desc" } as any,
    take: 50, // limite para não ficar pesado (suficiente para tela operacional)
    include: {
      items: {
        include: {
          product: {
            include: {
              bom: { include: { items: true } },
            } as any,
          },
        },
      },
    },
  } as any);

  const rows: Row[] = [];

  for (const order of orders as any[]) {
    const requiredByMaterial = new Map<string, number>();
    const items = order?.items ?? [];

    for (const it of items) {
      const qtyProduct = n(it.quantity);
      const bom = it?.product?.bom;
      if (!bom?.items?.length) continue;

      const lossBom = n(bom.lossPercent) / 100;
      for (const bi of bom.items) {
        const base = n(bi.quantity) * qtyProduct;
        const lossItem = n((bi as any).lossPercent) / 100;
        const need = base * (1 + lossBom) * (1 + lossItem);
        requiredByMaterial.set(bi.materialId, (requiredByMaterial.get(bi.materialId) ?? 0) + need);
      }
    }

    for (const [materialId, reservedNeed] of Array.from(requiredByMaterial.entries())) {
      if (reservedNeed <= 0) continue;
      rows.push({
        orderId: order.id,
        orderNumber: order.number ?? null,
        orderStatus: String(order.status ?? ""),
        materialId,
        reservedNeed,
      });
    }
  }

  // Enriquecer com material + aplicar busca
  const materialIds = Array.from(new Set(rows.map(r => r.materialId)));
  const mats = await prisma.material.findMany({
    where: { companyId, deletedAt: null, id: { in: materialIds } as any } as any,
    select: { id: true, name: true, code: true },
  } as any);
  const matMap = new Map(mats.map((m: any) => [m.id, m]));

  let enriched = rows.map(r => ({ ...r, material: matMap.get(r.materialId) ?? null }));

  if (q) {
    enriched = enriched.filter(r => {
      const num = String(r.orderNumber ?? "").toLowerCase();
      const mid = String(r.materialId ?? "").toLowerCase();
      const mname = String(r.material?.name ?? "").toLowerCase();
      const mcode = String(r.material?.code ?? "").toLowerCase();
      return (
        num.includes(q) ||
        mid.includes(q) ||
        mname.includes(q) ||
        mcode.includes(q)
      );
    });
  }

  // Ordenar: maior "reserva" primeiro (mais impactante)
  enriched.sort((a, b) => b.reservedNeed - a.reservedNeed);

  return NextResponse.json({ ok: true, rows: enriched.slice(0, take) });
}
