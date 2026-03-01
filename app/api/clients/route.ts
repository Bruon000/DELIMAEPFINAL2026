import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const clients = await prisma.client.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
    take: 200,
  });

  return NextResponse.json({ clients });
}
