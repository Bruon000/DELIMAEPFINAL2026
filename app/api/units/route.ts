import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const units = await prisma.unitOfMeasure.findMany({
    where: { companyId, isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, isActive: true },
    take: 300,
  });

  return NextResponse.json({ units });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const body = await req.json().catch(() => null);
  const code = String(body?.code ?? "").trim().toLowerCase();
  const name = String(body?.name ?? "").trim();

  if (!code) return NextResponse.json({ error: "code_required" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const exists = await prisma.unitOfMeasure.findFirst({
    where: { companyId, code },
    select: { id: true },
  });

  if (exists) return NextResponse.json({ error: "code_already_exists" }, { status: 409 });

  const unit = await prisma.unitOfMeasure.create({
    data: { companyId, code, name, isActive: true },
    select: { id: true, code: true, name: true, isActive: true },
  });

  return NextResponse.json({ unit }, { status: 201 });
}
