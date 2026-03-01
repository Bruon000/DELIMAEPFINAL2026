import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const item = await prisma.orderItem.findFirst({
    where: { id },
    include: { order: true },
  });

  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // @ts-expect-error
  if (item.order.companyId !== companyId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await prisma.orderItem.delete({ where: { id } as any });
  return NextResponse.json({ ok: true });
}
