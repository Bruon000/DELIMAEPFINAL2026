import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const r = await requireRole(["ADMIN"]);
  if (!r.ok) return r.res;
  const companyId = r.session.user!.companyId as string;

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
      items: {
        include: {
          material: {
            select: {
              id: true,
              name: true,
              code: true,
              currentCost: true,
              unit: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  } as any);

  return NextResponse.json({ product, bom });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const r = await requireRole(["ADMIN"]);
  if (!r.ok) return r.res;
  const companyId = r.session.user!.companyId as string;

  const productId = ctx.params.id;
  const body = await req.json().catch(() => null);
  const lossPercent = Number(body?.lossPercent ?? 0);

  if (lossPercent < 0) return NextResponse.json({ error: "invalid_loss" }, { status: 400 });

  const product = await prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null },
    select: { id: true },
  } as any);

  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bom = await prisma.bOM.upsert({
    where: { productId } as any,
    update: { lossPercent } as any,
    create: { productId, lossPercent } as any,
  } as any);

  return NextResponse.json({ bom });
}