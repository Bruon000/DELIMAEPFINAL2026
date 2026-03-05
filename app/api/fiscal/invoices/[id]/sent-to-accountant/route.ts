import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function requireRole(role: string | undefined, allowed: string[]) {
  return role && allowed.includes(role);
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!requireRole((session.user as { role?: string }).role, ["ADMIN"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const id = ctx.params.id;

  const body = (await req.json().catch(() => null)) as { note?: string } | null;
  const note = String(body?.note ?? "").trim();

  const inv = await prisma.fiscalInvoice.findFirst({ where: { id, companyId } });
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await prisma.fiscalInvoice.update({
    where: { id },
    data: {
      sentToAccountantAt: new Date(),
      sentToAccountantNote: note || null,
    },
    select: { id: true, sentToAccountantAt: true, sentToAccountantNote: true },
  });

  return NextResponse.json({ ok: true, invoice: updated });
}
