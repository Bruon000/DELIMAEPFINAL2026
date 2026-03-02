import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const quantity = body?.quantity === undefined ? undefined : Number(body.quantity);
  const lossPercent = body?.lossPercent === undefined ? undefined : Number(body.lossPercent);

  if (quantity !== undefined && quantity <= 0) return NextResponse.json({ error: "invalid_quantity" }, { status: 400 });
  if (lossPercent !== undefined && lossPercent < 0) return NextResponse.json({ error: "invalid_loss" }, { status: 400 });

  const item = await prisma.bOMItem.update({
    where: { id } as any,
    data: {
      ...(quantity !== undefined ? { quantity } : {}),
      ...(lossPercent !== undefined ? { lossPercent } : {}),
    } as any,
    include: { material: { select: { id: true, name: true, code: true } } },
  } as any);

  return NextResponse.json({ item });
}
export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = ctx.params.id;

  // (opcional) validar company via joins (MVP: delete direto)
  await prisma.bOMItem.delete({ where: { id } as any } as any);

  return NextResponse.json({ ok: true });
}

