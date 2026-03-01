import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const data: any = {};
  if (body?.name != null) data.name = String(body.name).trim();
  if (body?.document != null) data.document = String(body.document).trim() || null;
  if (body?.email != null) data.email = String(body.email).trim() || null;
  if (body?.phone != null) data.phone = String(body.phone).trim() || null;
  if (body?.isActive != null) data.isActive = !!body.isActive;

  const client = await prisma.client.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!client) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await prisma.client.update({
    where: { id } as any,
    data,
    select: { id: true, name: true, document: true, email: true, phone: true, isActive: true },
  } as any);

  return NextResponse.json({ client: updated });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const client = await prisma.client.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!client) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.client.update({
    where: { id } as any,
    data: { deletedAt: new Date(), isActive: false } as any,
  } as any);

  return NextResponse.json({ ok: true });
}
