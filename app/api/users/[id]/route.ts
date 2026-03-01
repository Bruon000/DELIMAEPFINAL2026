import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const data: any = {};
  if (body?.name != null) data.name = String(body.name).trim();
  if (body?.role != null) data.role = String(body.role).trim();
  if (body?.isActive != null) data.isActive = !!body.isActive;

  if (body?.password != null && String(body.password).trim().length >= 4) {
    data.passwordHash = await bcrypt.hash(String(body.password).trim(), 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, isActive: true, companyId: true, createdAt: true },
  });

  return NextResponse.json({ user: updated });
}
