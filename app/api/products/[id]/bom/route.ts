import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const productId = ctx.params.id;

  const product = await prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null },
    select: { id: true, name: true, code: true },
  } as any);

  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // bom 1:1 por produto (assumindo relation product.bom)
  const bom = await prisma.bOM.findFirst({
    where: { productId },
    include: {
      items: { include: { material: { select: { id: true, name: true, code: true } } }, orderBy: { createdAt: "asc" } },
    },
  } as any);

  return NextResponse.json({ product, bom });
}
