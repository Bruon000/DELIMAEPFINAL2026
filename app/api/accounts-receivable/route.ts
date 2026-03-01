import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session?.user?.companyId;const url = new URL(req.url);
  if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = url.searchParams.get("status") ?? "PENDING";

  const ars = await prisma.accountsReceivable.findMany({
    where: { companyId, status: status as any },
    orderBy: { createdAt: "desc" },
    include: {
      order: { include: { client: { select: { id: true, name: true } } } },
    },
    take: 200,
  } as any);

  return NextResponse.json({ ars });
}

