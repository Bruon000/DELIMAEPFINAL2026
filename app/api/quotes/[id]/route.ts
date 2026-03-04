import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;
  const quote = await prisma.quote.findFirst({
    where: { id, companyId, deletedAt: null } as any,
    include: {
      client: { select: { id: true, name: true } },
      items: {
        include: { product: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: "asc" } as any,
      },
    },
  } as any);

  if (!quote) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Orçamento não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, quote });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;
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

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;
  const updated = await prisma.quote.updateMany({
    where: { id, companyId, deletedAt: null } as any,
    data: { deletedAt: new Date() } as any,
  } as any);

  if (!updated.count) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Orçamento não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

