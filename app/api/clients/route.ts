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
    select: { id: true, name: true, document: true, email: true, phone: true, isActive: true },
    take: 500,
  });

  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const document = String(body?.document ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = String(body?.phone ?? "").trim();

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const client = await prisma.client.create({
    data: {
      id: `cli_${Date.now()}`,
      companyId,
      name,
      document: document || null,
      email: email || null,
      phone: phone || null,
      isActive: true,
    } as any,
    select: { id: true, name: true, document: true, email: true, phone: true, isActive: true },
  } as any);

  return NextResponse.json({ client }, { status: 201 });
}
