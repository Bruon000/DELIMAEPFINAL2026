import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") ?? "").trim();
  const take = Math.min(Number(url.searchParams.get("take") ?? 8), 20);

  // Lista inicial (para dropdown/prefetch no diálogo) quando q é vazio
  if (q.length === 0) {
    const rows = await prisma.fiscalTaxProfile.findMany({
      orderBy: [{ name: "asc" }],
      take,
      select: { id: true, name: true, description: true },
    });

    return NextResponse.json({
      q,
      results: rows.map((r) => ({
        id: r.id,
        code: r.name,
        description: r.description ?? "",
        label: r.description ? `${r.name} - ${r.description}` : r.name,
      })),
    });
  }

  if (q.length < 2) return NextResponse.json({ q, results: [] });

  const rows = await prisma.fiscalTaxProfile.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ name: "asc" }],
    take,
    select: { id: true, name: true, description: true },
  });

  return NextResponse.json({
    q,
    results: rows.map((r) => ({
      id: r.id,
      code: r.name,
      description: r.description ?? "",
      label: r.description ? `${r.name} - ${r.description}` : r.name,
    })),
  });
}
