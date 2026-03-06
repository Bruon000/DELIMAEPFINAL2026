import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") ?? "").trim();
  const take = Math.min(Number(url.searchParams.get("take") ?? 8), 20);

  // Se q vazio, retorna lista inicial
  if (q.length === 0) {
    const rows = await prisma.fiscalCest.findMany({
      orderBy: [{ code: "asc" }],
      take,
      select: { id: true, code: true, description: true },
    });
    return NextResponse.json({
      q,
      results: rows.map((r) => ({ ...r, label: `${r.code} - ${r.description}` })),
    });
  }

  if (q.length < 2) return NextResponse.json({ q, results: [] });

  const rows = await prisma.fiscalCest.findMany({
    where: {
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ code: "asc" }],
    take,
    select: { id: true, code: true, description: true },
  });

  return NextResponse.json({
    q,
    results: rows.map((r) => ({ ...r, label: `${r.code} - ${r.description}` })),
  });
}
