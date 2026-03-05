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

  const body = await req.json().catch(() => null);
  const percent = n(body?.discountPercent);

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return NextResponse.json({ error: "discountPercent_invalid" }, { status: 400 });
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId, deletedAt: null } as any,
    select: { id: true, subtotal: true, validUntil: true } as any,
  } as any);
  if (!quote) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const isLocked = quote.validUntil ? new Date(quote.validUntil) < new Date() : false;
  if (isLocked && role !== "ADMIN") {
    return NextResponse.json({ error: "quote_locked", message: "Orçamento vencido. Solicite desbloqueio ao ADMIN." }, { status: 423 });
  }

  // regra vendedor: até 5% sem aprovação
  if (role === "VENDEDOR" && percent > 5) {
    const approved = await prisma.discountApprovalRequest.findFirst({
      where: {
        companyId,
        quoteId,
        status: "APPROVED" as any,
      } as any,
      orderBy: { updatedAt: "desc" } as any,
      select: { approvedPercent: true, requestedPercent: true, id: true } as any,
    } as any);

    const limit = Number(approved?.approvedPercent ?? 0);
    if (!approved?.id || limit <= 0 || percent > limit) {
      return NextResponse.json({
        error: "discount_requires_approval",
        message: "Desconto acima de 5% requer aprovação do ADMIN.",
        approvedLimit: limit || null,
      }, { status: 403 });
    }
  }

  const subtotal = n(quote.subtotal);
  const discount = subtotal * (percent / 100);
  const total = Math.max(0, subtotal - discount);

  const updated = await prisma.quote.update({
    where: { id: quoteId } as any,
    data: {
      discountPercent: percent as any,
      discount: discount as any,
      total: total as any,
    } as any,
    select: { id: true, discountPercent: true, discount: true, total: true } as any,
  } as any);

  await writeAuditLog({
    companyId,
    userId,
    action: "QUOTE_DISCOUNT_SET",
    entity: "QUOTE",
    entityId: quoteId,
    payload: { discountPercent: percent, discount, total },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, quote: updated });
}
