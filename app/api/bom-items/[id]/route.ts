import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const id = ctx.params.id;

  // (opcional) validar company via joins (MVP: delete direto)
  await prisma.bomItem.delete({ where: { id } as any } as any);

  return NextResponse.json({ ok: true });
}
