import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET(_: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const id = ctx.params.id;

  const order = await prisma.order.findFirst({
    where: { id, companyId, deletedAt: null } as any,
    include: {
      client: true,
      items: { include: { product: { select: { id: true, name: true, code: true } } } } as any,
    },
  } as any);

  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  return NextResponse.json({ order });
}
