import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const role = String(session.user.role ?? "");
  if (role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const companyId = session.user.companyId as string;
  const id = ctx.params.id;

  const quote = await prisma.quote.findFirst({ where: { id, companyId, deletedAt: null } as any } as any);
  if (!quote) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const d = new Date();
  d.setDate(d.getDate() + 15);

  const updated = await prisma.quote.update({
    where: { id } as any,
    data: { validUntil: d } as any,
    select: { id: true, validUntil: true } as any,
  } as any);

  await writeAuditLog({
    companyId,
    userId: session.user.id as string,
    action: "QUOTE_UNLOCKED",
    entity: "QUOTE",
    entityId: id,
    payload: { newValidUntil: updated.validUntil },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, quote: updated });
}
