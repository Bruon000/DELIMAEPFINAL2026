import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      supplier: { select: { id: true, name: true, document: true, email: true, phone: true } },
      items: {
        include: { material: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  } as any);

  if (!po) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ purchaseOrder: po });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const exists = await prisma.purchaseOrder.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const data: any = {};
  if (body?.notes != null) data.notes = String(body.notes).trim() || null;
  if (body?.status != null) data.status = String(body.status).trim();

  const updated = await prisma.purchaseOrder.update({
    where: { id } as any,
    data,
  } as any);

  return NextResponse.json({ purchaseOrder: updated });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const exists = await prisma.purchaseOrder.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.purchaseOrder.update({
    where: { id } as any,
    data: { deletedAt: new Date(), status: "CANCELED" as any } as any,
  } as any);

  return NextResponse.json({ ok: true });
}
