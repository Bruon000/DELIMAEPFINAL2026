import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/rbac";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;
  const role = String((gate.session.user as any)?.role ?? "");
  const userId = String(gate.session.user!.id ?? "");

  const id = ctx.params.id;
  const quote = await prisma.quote.findFirst({
    where: { id, companyId, deletedAt: null } as any,
    select: { id: true, createdById: true } as any,
  } as any);

  if (!quote) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Orçamento não encontrado" }, { status: 404 });
  }

  if (role === "VENDEDOR" && String((quote as any).createdById ?? "") !== userId) {
    return NextResponse.json({ ok: false, error: "forbidden", message: "Sem permissão para acessar este orçamento." }, { status: 403 });
  }

  const full = await prisma.quote.findFirst({
    where: { id, companyId, deletedAt: null } as any,
    include: {
      client: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: "asc" } as any,
      },
    },
  } as any);

  return NextResponse.json({ ok: true, quote: full });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;
  const role = String((gate.session.user as any)?.role ?? "");
  const userId = String(gate.session.user!.id ?? "");
  const id = ctx.params.id;

  const quote = await prisma.quote.findFirst({ where: { id, companyId, deletedAt: null } as any } as any);
  if (!quote) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (role === "VENDEDOR" && String((quote as any).createdById ?? "") !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const isLocked = quote.validUntil ? new Date(quote.validUntil) < new Date() : false;
  if (isLocked && role !== "ADMIN") {
    return NextResponse.json(
      { error: "quote_locked", message: "Orçamento vencido (15 dias). Somente ADMIN pode desbloquear." },
      { status: 423 }
    );
  }

  const body = await req.json().catch(() => null);

  const notes = body?.notes !== undefined ? String(body.notes ?? "").trim() : undefined;
  const status = body?.status !== undefined ? String(body.status ?? "").trim() : undefined;
  const validUntil = body?.validUntil !== undefined ? String(body.validUntil ?? "").trim() : undefined;

  const updated = await prisma.quote.updateMany({
    where: { id, companyId, deletedAt: null } as any,
    data: {
      ...(notes !== undefined ? { notes: notes || null } : {}),
      ...(status ? { status: status as any } : {}),
      ...(validUntil !== undefined ? { validUntil: validUntil ? new Date(validUntil) : null } : {}),
    } as any,
  } as any);

  if (!updated.count) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Orçamento não encontrado" }, { status: 404 });
  }

  await writeAuditLog({
    companyId,
    userId: gate.session.user!.id as string,
    action: "QUOTE_UPDATED",
    entity: "QUOTE",
    entityId: id,
    payload: { note: "patch quote", lockedByValidUntil: isLocked },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;
  const role = String((gate.session.user as any)?.role ?? "");
  const userId = String(gate.session.user!.id ?? "");

  const id = ctx.params.id;
  const quote = await prisma.quote.findFirst({ where: { id, companyId, deletedAt: null } as any } as any);
  if (!quote) return NextResponse.json({ ok: false, error: "not_found", message: "Orçamento não encontrado" }, { status: 404 });
  if (role === "VENDEDOR" && String((quote as any).createdById ?? "") !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await prisma.quote.updateMany({
    where: { id, companyId, deletedAt: null } as any,
    data: { deletedAt: new Date() } as any,
  } as any);

  if (!updated.count) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Orçamento não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
