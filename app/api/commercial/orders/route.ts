import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;

  const url = new URL(req.url);

  const q = String(url.searchParams.get("q") ?? "").trim();
  const status = String(url.searchParams.get("status") ?? "").trim().toUpperCase();
  const mine = String(url.searchParams.get("mine") ?? "").trim() === "1";
  const from = String(url.searchParams.get("from") ?? "").trim();
  const to = String(url.searchParams.get("to") ?? "").trim();
  const cursor = String(url.searchParams.get("cursor") ?? "").trim() || null;

  const take = Math.min(Math.max(n(url.searchParams.get("take")), 1) || 30, 200);

  const where: any = { companyId, deletedAt: null };
  if (mine) where.userId = userId;

  const and: any[] = [];

  if (status && status !== "ALL") {
    and.push({ status: status as any });
  }

  if (q) {
    and.push({
      OR: [
        { number: { contains: q, mode: "insensitive" } as any },
        { id: { contains: q, mode: "insensitive" } as any },
        { client: { name: { contains: q, mode: "insensitive" } as any } },
      ],
    });
  }

  const fromDt = from ? new Date(from) : null;
  const toDt = to ? new Date(to) : null;
  if (fromDt && !isNaN(fromDt.getTime())) and.push({ createdAt: { gte: fromDt } });
  if (toDt && !isNaN(toDt.getTime())) and.push({ createdAt: { lte: toDt } });

  // cursor = ISO createdAt; pagina desc usando createdAt < cursor
  if (cursor) {
    const c = new Date(cursor);
    if (!isNaN(c.getTime())) and.push({ createdAt: { lt: c } });
  }

  if (and.length) where.AND = and;

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    include: {
      client: { select: { id: true, name: true } },
      items: { select: { total: true } },
    },
  } as any);

  const sliced = orders.slice(0, take);

  const rows = sliced.map((o: any) => {
    const total = (o.items ?? []).reduce((s: number, it: any) => s + Number(it.total ?? 0), 0);
    return {
      id: o.id,
      number: o.number ?? null,
      status: o.status,
      subtotal: o.subtotal ?? null,
      discount: o.discount ?? null,
      total,
      createdAt: o.createdAt,
      confirmedAt: o.confirmedAt ?? null,
      client: o.client ? { id: o.client.id, name: o.client.name } : null,
    };
  });

  let nextCursor: string | null = null;
  if (orders.length > take && sliced.length) {
    const last = sliced[sliced.length - 1] as any;
    nextCursor = last?.createdAt ? new Date(last.createdAt).toISOString() : null;
  }

  return NextResponse.json({ ok: true, rows, nextCursor });
}