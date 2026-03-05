import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

function n(x: any) { return Number(x ?? 0); }

export async function GET(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const url = new URL(req.url);
  const status = String(url.searchParams.get("status") ?? "PENDING").toUpperCase();
  const take = Math.min(Number(url.searchParams.get("take") ?? 100), 200);

  const rows = await prisma.discountApprovalRequest.findMany({
    where: { companyId, status: status as any } as any,
    orderBy: { createdAt: "desc" } as any,
    take,
    include: {
      quote: { select: { id: true, number: true, validUntil: true, total: true } } as any,
      requestedBy: { select: { id: true, name: true, email: true } } as any,
      approvedBy: { select: { id: true, name: true, email: true } } as any,
    } as any,
  } as any);

  return NextResponse.json({ ok: true, rows });
}

export async function PATCH(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const body = await req.json().catch(() => null);

  const id = String(body?.id ?? "").trim();
  const action = String(body?.action ?? "").trim().toUpperCase(); // APPROVE/REJECT
  const approvedPercent = n(body?.approvedPercent);

  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  if (action !== "APPROVE" && action !== "REJECT") return NextResponse.json({ error: "action_invalid" }, { status: 400 });

  const reqRow = await prisma.discountApprovalRequest.findFirst({
    where: { id, companyId } as any,
    include: { quote: { select: { id: true } } } as any,
  } as any);
  if (!reqRow) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String(reqRow.status) !== "PENDING") return NextResponse.json({ error: "not_pending" }, { status: 400 });

  if (action === "APPROVE") {
    if (!Number.isFinite(approvedPercent) || approvedPercent <= 5 || approvedPercent > 100) {
      return NextResponse.json({ error: "approvedPercent_invalid", message: "Aprovação deve ser > 5% e <= 100%." }, { status: 400 });
    }
  }

  const updated = await prisma.discountApprovalRequest.update({
    where: { id } as any,
    data: {
      status: (action === "APPROVE" ? "APPROVED" : "REJECTED") as any,
      approvedPercent: action === "APPROVE" ? (approvedPercent as any) : null,
      approvedById: userId,
    } as any,
    select: { id: true, status: true, approvedPercent: true } as any,
  } as any);

  await writeAuditLog({
    companyId,
    userId,
    action: action === "APPROVE" ? "DISCOUNT_REQUEST_APPROVED" : "DISCOUNT_REQUEST_REJECTED",
    entity: "QUOTE",
    entityId: reqRow.quoteId,
    payload: { requestId: id, requestedPercent: reqRow.requestedPercent, approvedPercent: updated.approvedPercent },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, row: updated });
}
