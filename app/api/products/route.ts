import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function toProductType(v: string) {
  const x = String(v ?? "").trim().toUpperCase();
  if (x === "SIMPLES") return "SIMPLE";
  if (x === "SIMPLE") return "SIMPLE";
  if (x === "COMPOSTO") return "COMPOSTO";
  if (x === "SOB_MEDIDA") return "SOB_MEDIDA";
  return "COMPOSTO";
}

export async function GET() {
  const r = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!r.ok) return r.res;
  const companyId = r.session.user!.companyId as string;

  const products = await prisma.product.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, salePrice: true, costPrice: true, type: true, isActive: true },
    take: 500,
  });

  return NextResponse.json({ products });
}

export async function POST(req: Request) {
  const r = await requireRole(["ADMIN"]);
  if (!r.ok) return r.res;
  const companyId = r.session.user!.companyId as string;

  const body = await req.json().catch(() => null);

  const name = String(body?.name ?? "").trim();
  const code = String(body?.code ?? "").trim();
  const salePrice = Number(body?.salePrice ?? 0);
  const costPrice = Number(body?.costPrice ?? 0);
  const type = toProductType(String(body?.type ?? "COMPOSTO"));
  const categoryId = String(body?.categoryId ?? "").trim();
  const unitId = String(body?.unitId ?? "").trim();

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const resolvedUnitId =
    unitId ||
    (
      await prisma.unitOfMeasure.findFirst({
        where: { companyId, isActive: true } as any,
        orderBy: [{ code: "asc" }] as any,
        select: { id: true } as any,
      } as any)
    )?.id ||
    "";

  if (!resolvedUnitId) {
    return NextResponse.json(
      { error: "unit_required", message: "Cadastre ao menos 1 unidade antes de criar produtos." },
      { status: 400 },
    );
  }

  const product = await prisma.product.create({
    data: {
      id: `prd_${Date.now()}`,
      company: { connect: { id: companyId } },
      name,
      code: code || null,
      salePrice,
      costPrice: Number.isFinite(costPrice) ? costPrice : null,
      type: type as any,
      categoryId: categoryId || null,
      unit: { connect: { id: resolvedUnitId } },
      isActive: true,
    } as any,
    select: { id: true, name: true, code: true, salePrice: true, costPrice: true, type: true, isActive: true },
  } as any);

  return NextResponse.json({ product }, { status: 201 });
}
