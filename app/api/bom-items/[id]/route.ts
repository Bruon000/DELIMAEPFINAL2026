import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const r = await requireRole(["ADMIN"]);
  if (!r.ok) return r.res;

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const quantity = body?.quantity === undefined ? undefined : Number(body.quantity);
  const lossPercent = body?.lossPercent === undefined ? undefined : Number(body.lossPercent);

  if (quantity !== undefined && quantity <= 0) return NextResponse.json({ error: "invalid_quantity" }, { status: 400 });
  if (lossPercent !== undefined && lossPercent < 0) return NextResponse.json({ error: "invalid_loss" }, { status: 400 });

  const item = await prisma.bOMItem.update({
    where: { id } as any,
    data: {
      ...(quantity !== undefined ? { quantity } : {}),
      ...(lossPercent !== undefined ? { lossPercent } : {}),
    } as any,
    include: { material: { select: { id: true, name: true, code: true } } },
  } as any);

  return NextResponse.json({ item });
}
export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const r = await requireRole(["ADMIN"]);
  if (!r.ok) return r.res;
  const companyId = r.session.user!.companyId as string;

  const id = ctx.params.id;

  // valida company via join: BOMItem -> BOM -> Product(companyId)
  const item: any = await prisma.bOMItem.findFirst({
    where: { id } as any,
    include: {
      bom: {
        include: {
          product: { select: { companyId: true, deletedAt: true } } as any,
        } as any,
      } as any,
    } as any,
  } as any);

  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (item?.bom?.product?.companyId !== companyId || item?.bom?.product?.deletedAt) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.bOMItem.delete({ where: { id } as any } as any);

  return NextResponse.json({ ok: true });
}



