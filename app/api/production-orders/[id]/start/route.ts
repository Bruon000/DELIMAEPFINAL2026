import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const op = await prisma.productionOrder.findFirst({ where: { id, companyId } } as any);
  if (!op) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await prisma.productionOrder.update({
    where: { id } as any,
    data: { status: "IN_PROGRESS" as any, startedAt: new Date() } as any,
  } as any);

  return NextResponse.json({ ok: true, op: updated });
}
