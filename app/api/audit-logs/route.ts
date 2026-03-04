import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const url = new URL(req.url);

  const entity = String(url.searchParams.get("entity") ?? "");
  const entityId = String(url.searchParams.get("entityId") ?? "");
  const take = Math.min(Number(url.searchParams.get("take") ?? 50), 200);
  const cursor = String(url.searchParams.get("cursor") ?? "").trim();

  if (!entity || !entityId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const rows = await prisma.auditLog.findMany({
    where: { companyId, entity, entityId } as any,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }] as any,
    take: take + 1,
    ...(cursor
      ? {
          cursor: { id: cursor } as any,
          skip: 1,
        }
      : {}),
  } as any);

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return NextResponse.json({ rows: page, nextCursor });
}
