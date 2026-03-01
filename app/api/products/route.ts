import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const products = await prisma.product.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, salePrice: true },
    take: 500,
  });

  return NextResponse.json({ products });
}
