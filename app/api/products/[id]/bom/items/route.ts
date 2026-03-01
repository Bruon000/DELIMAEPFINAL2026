import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const productId = ctx.params.id;
  const body = await req.json().catch(() => null);

  const materialId = String(body?.materialId ?? "").trim();
  const quantity = Number(body?.quantity ?? 0);

  if (!materialId || quantity <= 0) return NextResponse.json({ error: "invalid_item" }, { status: 400 });

  const product = await prisma.product.findFirst({ where: { id: productId, companyId, deletedAt: null } } as any);
  if (!product) return NextResponse.json({ error: "product_not_found" }, { status: 404 });

  // garante BOM
  const bom = await prisma.bom.upsert({
    where: { productId } as any,
    update: {},
    create: { productId, lossPercent: 0 } as any,
  } as any);

  const item = await prisma.bomItem.create({
    data: {
      id: `bmi_${Date.now()}`,
      bomId: bom.id,
      materialId,
      quantity,
    } as any,
    include: { material: { select: { id: true, name: true, code: true } } },
  } as any);

  return NextResponse.json({ item }, { status: 201 });
}
