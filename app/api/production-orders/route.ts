import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // ex: PENDING|IN_PROGRESS|DONE

  const where: any = { companyId };
  if (status) where.status = status;

  const ops = await prisma.productionOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        select: {
          id: true,
          status: true,
          client: { select: { id: true, name: true } },
        },
      },
    },
    take: 200,
  } as any);

  return NextResponse.json({ ops });
}
