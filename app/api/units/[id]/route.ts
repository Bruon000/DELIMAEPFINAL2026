import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const exists = await prisma.unitOfMeasure.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data: any = {};
  if (body?.code != null) data.code = String(body.code).trim().toLowerCase();
  if (body?.name != null) data.name = String(body.name).trim();
  if (body?.isActive != null) data.isActive = !!body.isActive;

  const updated = await prisma.unitOfMeasure.update({
    where: { id } as any,
    data,
    select: { id: true, code: true, name: true, isActive: true },
  });

  return NextResponse.json({ unit: updated });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const exists = await prisma.unitOfMeasure.findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.unitOfMeasure.update({
    where: { id } as any,
    data: { isActive: false } as any,
  });

  return NextResponse.json({ ok: true });
}
