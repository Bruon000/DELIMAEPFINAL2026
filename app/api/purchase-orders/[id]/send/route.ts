import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;
  const id = ctx.params.id;

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, status: true },
  } as any);

  if (!po) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (String(po.status) !== "DRAFT") {
    return NextResponse.json({ error: "invalid_status", status: po.status }, { status: 400 });
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id } as any,
    data: { status: "SENT" as any } as any,
    select: { id: true, status: true },
  } as any);

  await writeAuditLog({
    companyId,
    userId,
    action: "PO_SENT",
    entity: "PURCHASE_ORDER",
    entityId: id,
    payload: { from: po.status, to: updated.status },
    ip: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, purchaseOrderId: updated.id, status: updated.status });
}
