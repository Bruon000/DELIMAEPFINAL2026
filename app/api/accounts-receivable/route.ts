import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session?.user?.companyId;
  const url = new URL(req.url);
  if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = String(url.searchParams.get("status") ?? "PENDING").toUpperCase();
  const q = String(url.searchParams.get("q") ?? "").trim().toLowerCase();

  const where: any = { companyId };
  if (status && status !== "ALL") where.status = status as any;

  const ars = await prisma.accountsReceivable.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      order: { include: { client: { select: { id: true, name: true } } } },
    },
    take: 200,
  } as any);

  const filtered = (ars ?? []).filter((ar: any) => {
    if (!q) return true;
    const id = String(ar.id ?? "").toLowerCase();
    const orderId = String(ar.orderId ?? "").toLowerCase();
    const clientName = String(ar?.order?.client?.name ?? "").toLowerCase();
    return id.includes(q) || orderId.includes(q) || clientName.includes(q);
  });

  return NextResponse.json({ ars: filtered });
}

