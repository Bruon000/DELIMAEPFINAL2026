import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function n(x: unknown) {
  return Number(x ?? 0);
}

export async function GET() {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = String(gate.session.user!.role ?? "");

  const isVendedor = role === "VENDEDOR";
  const orderWhere: { companyId: string; deletedAt: null; createdById?: string } = {
    companyId,
    deletedAt: null,
  };
  if (isVendedor) orderWhere.createdById = userId;

  const arWhere: any = { companyId, status: "PENDING" };
  if (isVendedor) arWhere.order = { createdById: userId };

  const [drafts, openOrders, clientCounts, criticalRows, carteiraRows] = await Promise.all([
    prisma.order.findMany({
      where: { ...orderWhere, status: "DRAFT" } as any,
      orderBy: { updatedAt: "desc" } as any,
      take: 10,
      select: {
        id: true,
        number: true,
        status: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    } as any),
    prisma.order.findMany({
      where: { ...orderWhere, status: "OPEN" } as any,
      orderBy: { sentToCashierAt: "desc" } as any,
      take: 10,
      select: {
        id: true,
        number: true,
        status: true,
        sentToCashierAt: true,
        client: { select: { id: true, name: true } },
      },
    } as any),
    prisma.order.groupBy({
      by: ["clientId"],
      where: { companyId, deletedAt: null } as any,
      _count: { id: true },
    } as any).then((r: any[]) => r.sort((a, b) => (b._count?.id ?? 0) - (a._count?.id ?? 0)).slice(0, 10)),
    fetchCriticalStock(companyId),
    prisma.accountsReceivable.findMany({
      where: arWhere,
      orderBy: { dueDate: "asc" } as any,
      take: 10,
      select: {
        id: true,
        orderId: true,
        dueDate: true,
        amount: true,
        order: {
          select: {
            number: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    } as any),
  ]);

  const clientIds = Array.from(new Set(clientCounts.map((c: any) => c.clientId)));
  const clients =
    clientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: clientIds }, companyId, deletedAt: null } as any,
          select: { id: true, name: true },
        } as any)
      : [];
  const clientMap = new Map(clients.map((c: any) => [c.id, c.name]));
  const countMap = new Map(clientCounts.map((c: any) => [c.clientId, c._count?.id ?? 0]));

  const frequentClients = clientCounts.map((c: any) => ({
    id: c.clientId,
    name: clientMap.get(c.clientId) ?? "—",
    orderCount: countMap.get(c.clientId) ?? 0,
  }));

  const carteira = (carteiraRows ?? []).map((ar: any) => ({
    id: ar.id,
    orderId: ar.orderId,
    dueDate: ar.dueDate,
    amount: Number(ar.amount ?? 0),
    orderNumber: ar.order?.number ?? null,
    client: ar.order?.client ? { id: ar.order.client.id, name: ar.order.client.name } : null,
  }));

  const carteiraTotal = carteira.reduce((sum: number, ar: any) => sum + (ar.amount ?? 0), 0);

  return NextResponse.json({
    drafts: drafts.map((o: any) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      createdAt: o.createdAt,
      client: o.client ? { id: o.client.id, name: o.client.name } : null,
    })),
    openOrders: openOrders.map((o: any) => ({
      id: o.id,
      number: o.number,
      status: o.status,
      sentToCashierAt: o.sentToCashierAt,
      client: o.client ? { id: o.client.id, name: o.client.name } : null,
    })),
    carteira,
    carteiraTotal,
    frequentClients,
    stockAlerts: criticalRows,
  });
}

async function fetchCriticalStock(companyId: string): Promise<{ materialId: string; materialName: string; minStock: number; available: number }[]> {
  const mats = await prisma.material.findMany({
    where: { companyId, deletedAt: null, minStock: { gt: 0 } } as any,
    take: 50,
    select: { id: true, name: true, minStock: true },
  } as any);

  if (mats.length === 0) return [];

  const ids = mats.map((m: any) => m.id);
  const stocks = await prisma.stockItem.findMany({
    where: { materialId: { in: ids } } as any,
    select: { materialId: true, quantity: true, reserved: true },
  } as any);
  const sm = new Map(stocks.map((s: any) => [s.materialId, s]));

  const result: { materialId: string; materialName: string; minStock: number; available: number }[] = [];
  for (const m of mats) {
    const s = sm.get(m.id);
    const qty = n(s?.quantity);
    const res = n(s?.reserved);
    const available = qty - res;
    const minStock = n(m.minStock);
    if (available + 1e-9 < minStock) {
      result.push({
        materialId: m.id,
        materialName: m.name,
        minStock,
        available,
      });
    }
  }
  return result.slice(0, 10);
}
