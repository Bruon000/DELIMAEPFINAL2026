import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function requireRole(role: string | undefined, allowed: string[]) {
  return role && allowed.includes(role);
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!requireRole((session.user as { role?: string }).role, ["ADMIN", "CAIXA"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const id = ctx.params.id;

  const inv = await prisma.fiscalInvoice.findFirst({
    where: { id, companyId },
  });

  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ invoice: inv });
}
