import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const url = new URL(req.url);
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
