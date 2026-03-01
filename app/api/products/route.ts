import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const products = await prisma.product.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, salePrice: true, costPrice: true, type: true, isActive: true },
    take: 500,
  });

  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const body = await req.json().catch(() => null);

  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const salePrice = Number(body?.salePrice ?? 0);
  const costPrice = Number(body?.costPrice ?? 0);
  const type = String(body?.type ?? "COMPOSTO").trim(); // COMPOSTO/SIMPLES etc
  const categoryId = String(body?.categoryId ?? "").trim();
  const unitId = String(body?.unitId ?? "").trim();

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const product = await prisma.product.create({
    data: {
      id: `prd_${Date.now()}`,
      companyId,
      name,
      code: code || null,
      salePrice,
      costPrice,
      type: type as any,
      categoryId: categoryId || null,
      unitId: unitId || null,
      isActive: true,
    } as any,
    select: { id: true, name: true, code: true, salePrice: true, costPrice: true, type: true, isActive: true },
  } as any);

  return NextResponse.json({ product }, { status: 201 });
}
