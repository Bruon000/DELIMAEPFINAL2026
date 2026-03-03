import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const url = new URL(req.url);
  const materialId = String(url.searchParams.get("materialId") ?? "").trim() || null;
  const type = String(url.searchParams.get("type") ?? "").trim().toUpperCase() || null;
  const q = String(url.searchParams.get("q") ?? "").trim();
  const from = String(url.searchParams.get("from") ?? "").trim();
  const to = String(url.searchParams.get("to") ?? "").trim();
  const take = Math.min(Math.max(n(url.searchParams.get("take")), 1) || 50, 200);

  // cursor = ISO date (createdAt) for pagination
  const cursor = String(url.searchParams.get("cursor") ?? "").trim() || null;

  const where: any = {
    material: { companyId, deletedAt: null },
  };

  if (materialId) where.materialId = materialId;
  if (type) where.type = type;

  const and: any[] = [];

  if (q) {
    and.push({
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { note: { contains: q, mode: "insensitive" } },
        { material: { name: { contains: q, mode: "insensitive" } } },
        { material: { code: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  const fromDt = from ? new Date(from) : null;
  const toDt = to ? new Date(to) : null;
  if (fromDt && !isNaN(fromDt.getTime())) and.push({ createdAt: { gte: fromDt } });
  if (toDt && !isNaN(toDt.getTime())) and.push({ createdAt: { lte: toDt } });

  if (cursor) {
    const c = new Date(cursor);
    if (!isNaN(c.getTime())) and.push({ createdAt: { lt: c } });
  }

  if (and.length) where.AND = and;

  const rows = await prisma.stockLedger.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    include: { material: { select: { id: true, name: true, code: true } } },
  } as any);

  let nextCursor: string | null = null;
  const sliced = rows.slice(0, take);

  if (rows.length > take) {
    const last = sliced[sliced.length - 1] as any;
    nextCursor = last?.createdAt ? new Date(last.createdAt).toISOString() : null;
  }

  return NextResponse.json({ ok: true, rows: sliced, nextCursor });
}
