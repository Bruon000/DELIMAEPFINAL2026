import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const item = await prisma.purchaseOrderItem.findFirst({
    where: { id },
    include: { po: true },
  } as any);

  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // @ts-expect-error
  if (item.po.companyId !== companyId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (String(item.po.status) !== "DRAFT") return NextResponse.json({ error: "po_not_draft" }, { status: 400 });

  await prisma.purchaseOrderItem.delete({ where: { id } as any } as any);
  return NextResponse.json({ ok: true });
}
