import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;

  const suppliers = await prisma.supplier.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      tradeName: true,
      document: true,
      email: true,
      phone: true,
      isActive: true,
    },
    take: 200,
  } as any);

  return NextResponse.json({ suppliers });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const supplier = await prisma.supplier.create({
    data: {
      companyId,
      name,
      tradeName: body?.tradeName ?? null,
      document: body?.document ?? null,
      email: body?.email ?? null,
      phone: body?.phone ?? null,
      isActive: true,
    } as any,
    select: { id: true, name: true },
  } as any);

  return NextResponse.json({ ok: true, id: supplier.id });
}
