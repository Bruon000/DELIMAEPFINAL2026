import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const units = await prisma.unitOfMeasure.findMany({
    where: { companyId, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
    take: 100,
  });

  return NextResponse.json({ units });
}
