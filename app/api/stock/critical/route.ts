import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized", message: "Não autorizado" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const url = new URL(req.url);

  const q = String(url.searchParams.get("q") ?? "").trim();
  const mode = String(url.searchParams.get("mode") ?? "available").trim(); // available | total
  const unitId = String(url.searchParams.get("unitId") ?? "").trim();
  const take = Math.min(Math.max(n(url.searchParams.get("take")), 1) || 200, 400);

  const where: any = {
    companyId,
    deletedAt: null,
    minStock: { gt: 0 },
  };
  if (unitId) where.unitId = unitId;
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
    ];
  }

  const mats = await prisma.material.findMany({
    where,
    take,
    orderBy: { updatedAt: "desc" } as any,
    select: {
      id: true,
      name: true,
      code: true,
      minStock: true,
      unitId: true,
      currentCost: true,
      unit: { select: { id: true, code: true, name: true } },
    },
  } as any);

  const ids = mats.map((m: any) => m.id);

  const stocks = await prisma.stockItem.findMany({
    where: { materialId: { in: ids } } as any,
    select: { materialId: true, quantity: true, reserved: true, updatedAt: true },
  } as any);

  const sm = new Map(stocks.map((s: any) => [s.materialId, s]));

  const allMapped = mats.map((m: any) => {
    const s = sm.get(m.id);
    const qty = n(s?.quantity);
    const res = n(s?.reserved);
    const available = qty - res;
    const minStock = n(m.minStock);
    const cost = n(m.currentCost);

    const metric = mode === "total" ? qty : available;
    const critical = metric + 1e-9 < minStock;
    const deficitQty = critical ? Math.max(0, minStock - (mode === "total" ? qty : available)) : 0;
    const deficitValue = deficitQty * cost;

    return {
      materialId: m.id,
      minStock,
      quantity: qty,
      reserved: res,
      available,
      critical,
      deficitQty,
      deficitValue,
      unit: m.unit ? { id: m.unit.id, code: m.unit.code, name: m.unit.name } : null,
      material: { id: m.id, name: m.name, code: m.code ?? null },
    };
  });

  const rows = allMapped
    .filter((r: any) => r.critical)
    .sort((a: any, b: any) => (a.available - a.minStock) - (b.available - b.minStock));

  const summary = {
    totalCritical: rows.length,
    totalDeficitQty: rows.reduce((acc: number, r: any) => acc + (r.deficitQty ?? 0), 0),
    totalDeficitValue: rows.reduce((acc: number, r: any) => acc + (r.deficitValue ?? 0), 0),
  };

  return NextResponse.json({ ok: true, rows, summary });
}
