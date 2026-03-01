import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const exists = await prisma.material.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data: any = {};
  if (body?.name != null) data.name = String(body.name).trim();
  if (body?.unitId != null) data.unitId = String(body.unitId).trim();
  if (body?.code != null) data.code = String(body.code).trim() || null;
  if (body?.currentCost != null) data.currentCost = Number(body.currentCost);
  if (body?.minStock != null) data.minStock = body.minStock === "" ? null : Number(body.minStock);
  if (body?.isActive != null) data.isActive = !!body.isActive;

  const updated = await prisma.material.update({
    where: { id } as any,
    data,
    include: { unit: { select: { id: true, code: true, name: true } } },
  } as any);

  return NextResponse.json({ material: updated });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const exists = await prisma.material.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.material.update({
    where: { id } as any,
    data: { deletedAt: new Date(), isActive: false } as any,
  } as any);

  return NextResponse.json({ ok: true });
}
