import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const materials = await prisma.material.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      unit: { select: { id: true, code: true, name: true } },
    },
    take: 500,
  } as any);

  return NextResponse.json({ materials });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const body = await req.json().catch(() => null);

  const name = String(body?.name ?? "").trim();
  const unitId = String(body?.unitId ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const currentCost = Number(body?.currentCost ?? 0);
  const minStock = body?.minStock === "" || body?.minStock == null ? null : Number(body.minStock);
  const isActive = body?.isActive == null ? true : !!body.isActive;

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!unitId) return NextResponse.json({ error: "unit_required" }, { status: 400 });

  const material = await prisma.material.create({
    data: {
      id: `mat_${Date.now()}`,
      companyId,
      unitId,
      name,
      code: code || null,
      currentCost,
      minStock,
      isActive,
    } as any,
    include: { unit: { select: { id: true, code: true, name: true } } },
  } as any);

  // garante stockItem
  await prisma.stockItem.upsert({
    where: { materialId: material.id } as any,
    update: {},
    create: { materialId: material.id, quantity: 0, reserved: 0 } as any,
  } as any);

  return NextResponse.json({ material }, { status: 201 });
}
