import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const r = await requireRole(["ADMIN"]);
  if (!r.ok) return r.res;
  const companyId = r.session.user!.companyId as string;

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const exists = await prisma.product.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data: any = {};
  if (body?.name != null) data.name = String(body.name).trim();
  if (body?.code != null) data.code = String(body.code).trim() || null;
  if (body?.salePrice != null) data.salePrice = Number(body.salePrice);
  if (body?.costPrice != null) data.costPrice = Number(body.costPrice);
  if (body?.type != null) data.type = String(body.type).trim();
  if (body?.isActive != null) data.isActive = !!body.isActive;

  const updated = await prisma.product.update({
    where: { id } as any,
    data,
    select: { id: true, name: true, code: true, salePrice: true, costPrice: true, type: true, isActive: true },
  } as any);

  return NextResponse.json({ product: updated });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const r = await requireRole(["ADMIN"]);
  if (!r.ok) return r.res;
  const companyId = r.session.user!.companyId as string;

  const id = ctx.params.id;

  const exists = await prisma.product.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.product.update({
    where: { id } as any,
    data: { deletedAt: new Date(), isActive: false } as any,
  } as any);

  return NextResponse.json({ ok: true });
}
