import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const url = new URL(req.url);
  const materialId = url.searchParams.get("materialId");
  const type = url.searchParams.get("type");
  const take = Math.min(Number(url.searchParams.get("take") ?? 200), 500);

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: any = { material: { companyId } };
  if (materialId) where.materialId = materialId;
  if (type) where.type = type;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const rows = await prisma.stockLedger.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    include: { material: { select: { id: true, name: true, code: true } } },
  } as any);

  return NextResponse.json({ rows });
}
