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
  const onlyPositive = String(url.searchParams.get("onlyPositive") ?? "1").trim() !== "0";
  const take = Math.min(Math.max(n(url.searchParams.get("take")), 1) || 100, 300);

  const where: any = {
    material: { companyId, deletedAt: null },
  };

  if (onlyPositive) where.reserved = { gt: 0 };

  if (q) {
    where.OR = [
      { materialId: { contains: q, mode: "insensitive" } },
      { material: { name: { contains: q, mode: "insensitive" } } },
      { material: { code: { contains: q, mode: "insensitive" } } },
    ];
  }

  const rows = await prisma.stockItem.findMany({
    where,
    take,
    orderBy: [{ reserved: "desc" }, { updatedAt: "desc" }] as any,
    select: {
      materialId: true,
      quantity: true,
      reserved: true,
      updatedAt: true,
      material: { select: { id: true, name: true, code: true, unitId: true } },
    },
  } as any);

  const out = rows.map((r: any) => {
    const qty = n(r.quantity);
    const res = n(r.reserved);
    return {
      materialId: r.materialId,
      quantity: qty,
      reserved: res,
      available: qty - res,
      updatedAt: r.updatedAt,
      material: r.material ?? null,
    };
  });

  return NextResponse.json({ ok: true, rows: out });
}
