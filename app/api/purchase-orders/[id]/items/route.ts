import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const poId = ctx.params.id;
  const body = await req.json().catch(() => null);

  const materialId = String(body?.materialId ?? "").trim();
  const quantity = n(body?.quantity);
  const unitCost = n(body?.unitCost);

  if (!materialId || quantity <= 0 || unitCost <= 0) {
  return NextResponse.json({ error: "invalid_item" }, { status: 400 });
}const po = await prisma.purchaseOrder.findFirst({ where: { id: poId, companyId, deletedAt: null } } as any);
  if (!po) return NextResponse.json({ error: "po_not_found" }, { status: 404 });
  if (String(po.status) !== "DRAFT") return NextResponse.json({ error: "po_not_draft" }, { status: 400 });

  const mat = await prisma.material.findFirst({ where: { id: materialId, companyId, deletedAt: null } } as any);
  if (!mat) return NextResponse.json({ error: "material_not_found" }, { status: 404 });

  const total = quantity * unitCost;

  const item = await prisma.purchaseOrderItem.create({
    data: { poId, materialId, quantity, unitCost, total } as any,
    include: { material: { select: { id: true, name: true, code: true } } },
  } as any);

  return NextResponse.json({ item }, { status: 201 });
}

