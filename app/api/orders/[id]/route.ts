import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = String((gate.session.user as any)?.role ?? "");

  const id = ctx.params.id;

  const order = await prisma.order.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      client: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  } as any);

  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (role === "VENDEDOR" && String((order as any).createdById ?? "") !== String(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ order });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = String((gate.session.user as any)?.role ?? "");

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const existing = await prisma.order.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (role === "VENDEDOR" && String((existing as any).createdById ?? "") !== String(userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const data: any = {};
  if (body?.clientId != null) data.clientId = String(body.clientId).trim();
  if (body?.notes != null) data.notes = String(body.notes).trim() || null;

  await prisma.order.update({
    where: { id } as any,
    data,
  } as any);

  return NextResponse.json({ ok: true });
}
