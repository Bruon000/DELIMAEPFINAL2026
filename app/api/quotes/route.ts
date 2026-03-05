import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
/**
 * GET /api/quotes
 * Query:
 * - q: busca (client.name, quote.number, quote.id)
 * - status: QuoteStatus
 * - mine: 1 (somente createdById = user)
 * - from/to: ISO date (createdAt)
 * - take: 1..200 (default 30)
 * - cursor: ISO createdAt (paginacao)
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;

  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") ?? "").trim();
  const status = String(url.searchParams.get("status") ?? "").trim();
  const mine = String(url.searchParams.get("mine") ?? "").trim() === "1";
  const from = String(url.searchParams.get("from") ?? "").trim();
  const to = String(url.searchParams.get("to") ?? "").trim();

  const takeRaw = Number(url.searchParams.get("take") ?? 30);
  const take = Math.min(Math.max(Number.isFinite(takeRaw) ? takeRaw : 30, 1), 200);

  const cursor = String(url.searchParams.get("cursor") ?? "").trim();

  const where: any = {
    companyId,
    deletedAt: null,
  };
  if (mine) where.createdById = userId;
  if (status && status !== "ALL") where.status = status as any;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) {
      const d = new Date(to);
      // inclui o dia inteiro
      d.setHours(23, 59, 59, 999);
      where.createdAt.lte = d;
    }
  }
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { number: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const list = await prisma.quote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor
      ? {
          cursor: { createdAt: new Date(cursor) } as any,
          skip: 1,
        }
      : {}),
    include: {
      client: { select: { id: true, name: true } },
    },
  } as any);

  const hasNext = list.length > take;
  const slice = list.slice(0, take);
  const nextCursor = hasNext ? String(slice[slice.length - 1]?.createdAt?.toISOString?.() ?? "") : null;

  const rows = slice.map((r: any) => ({
    isLocked: r.validUntil ? new Date(r.validUntil) < new Date() : false,
    daysLeft: r.validUntil ? Math.ceil((new Date(r.validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null,
    id: r.id,
    number: r.number ?? null,
    status: String(r.status ?? ""),
    subtotal: r.subtotal,
    discount: r.discount,
    total: r.total,
    createdAt: r.createdAt,
    validUntil: r.validUntil ?? null,
    client: r.client ? { id: r.client.id, name: r.client.name } : null,
  }));

  return NextResponse.json({ ok: true, rows, nextCursor });
}

/**
 * POST /api/quotes
 * Body:
 * - clientId (obrig)
 * - notes? validUntil?
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }
  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;

  const body = await req.json().catch(() => null);
  const clientId = String(body?.clientId ?? "").trim();
  const notes = String(body?.notes ?? "").trim();
  const validUntilRaw = String(body?.validUntil ?? "").trim();

  // validade padrão: 15 dias
  const defaultValidUntil = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d;
  })();

  if (!clientId) {
    return NextResponse.json({ ok: false, error: "client_required", message: "Informe o cliente." }, { status: 400 });
  }

  const quote = await prisma.quote.create({
    data: {
      companyId,
      clientId,
      createdById: userId,
      status: "DRAFT" as any,
      notes: notes || null,
      validUntil: validUntilRaw ? new Date(validUntilRaw) : defaultValidUntil,
      subtotal: 0 as any,
      discount: 0 as any,
      total: 0 as any,
    } as any,
    select: { id: true },
  } as any);

  return NextResponse.json({ ok: true, id: quote.id }, { status: 201 });
}

