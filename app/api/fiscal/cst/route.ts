import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ q, results: [] });

  const take = Math.min(Number(url.searchParams.get("take") ?? 20), 50);

  const items = await prisma.fiscalCst.findMany({
    where: {
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, code: true, description: true },
    orderBy: [{ code: "asc" }],
    take,
  });

  const results = items.map((x) => ({ id: x.id, code: x.code, description: x.description, label: `${x.code} - ${x.description}` }));
  return NextResponse.json({ q, results });
}
