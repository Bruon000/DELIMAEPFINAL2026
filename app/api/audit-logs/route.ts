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

  if (!entity || !entityId) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const rows = await prisma.auditLog.findMany({
    where: { companyId, entity, entityId },
    orderBy: { createdAt: "desc" },
    take,
  } as any);

  return NextResponse.json({ rows });
}
