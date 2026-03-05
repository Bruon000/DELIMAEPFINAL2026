import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = String(gate.session.user!.role ?? "");
  const quoteId = ctx.params.id;

  // vendedor só solicita; admin pode também (opcional)
  if (role !== "VENDEDOR" && role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const requestedPercent = n(body?.requestedPercent);
  const reason = String(body?.reason ?? "").trim() || null;

  if (!Number.isFinite(requestedPercent) || requestedPercent <= 5) {
    return NextResponse.json({ error: "requestedPercent_invalid", message: "Solicitação deve ser acima de 5%." }, { status: 400 });
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId, deletedAt: null } as any,
    select: { id: true, validUntil: true } as any,
  } as any);
  if (!quote) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isLocked = quote.validUntil ? new Date(quote.validUntil) < new Date() : false;
  if (isLocked && role !== "ADMIN") {
    return NextResponse.json({ error: "quote_locked", message: "Orçamento vencido. Solicite desbloqueio ao ADMIN." }, { status: 423 });
  }

  // evita spam: se já existe PENDING, retorna 409
  const pending = await prisma.discountApprovalRequest.findFirst({
    where: { companyId, quoteId, status: "PENDING" as any } as any,
    select: { id: true } as any,
  } as any);
  if (pending) return NextResponse.json({ error: "already_pending", requestId: pending.id }, { status: 409 });

  const created = await prisma.discountApprovalRequest.create({
    data: {
      companyId,
      quoteId,
      requestedById: userId,
      requestedPercent: requestedPercent as any,
      reason,
      status: "PENDING" as any,
    } as any,
    select: { id: true } as any,
  } as any);

  await writeAuditLog({
    companyId,
    userId,
    action: "DISCOUNT_REQUEST_CREATED",
    entity: "QUOTE",
    entityId: quoteId,
    payload: { requestId: created.id, requestedPercent, reason },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, requestId: created.id }, { status: 201 });
}
