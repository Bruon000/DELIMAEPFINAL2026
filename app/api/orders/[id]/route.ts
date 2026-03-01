import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const order = await prisma.order.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      client: { select: { id: true, name: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ order });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const data: any = {};
  if (body?.clientId != null) data.clientId = String(body.clientId).trim();
  if (body?.notes != null) data.notes = String(body.notes).trim() || null;

  const updated = await prisma.order.update({
    where: { id } as any,
    data,
  });

  // garante que pertence à company (se seu schema não força)
  if ((updated as any).companyId && (updated as any).companyId !== companyId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
