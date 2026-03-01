import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const op = await prisma.productionOrder.findFirst({
    where: { id, companyId },
    include: {
      order: {
        include: {
          client: { select: { id: true, name: true } },
          items: {
            include: {
              product: {
                include: {
                  bom: { include: { items: true } },
                } as any,
              },
            },
          },
        },
      },
    },
  } as any);

  if (!op) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // calcular materiais necessários via BOM * quantidade
  const requiredByMaterial: Record<string, number> = {};
  const items = (op as any).order?.items ?? [];

  for (const it of items) {
    const qtyProduct = Number(it.quantity ?? 0);
    const bom = (it.product as any)?.bom;
    if (!bom?.items?.length) continue;

    const loss = Number(bom.lossPercent ?? 0) / 100;

    for (const bi of bom.items) {
      const base = Number(bi.quantity ?? 0) * qtyProduct;
      const need = base * (1 + loss);
      requiredByMaterial[bi.materialId] = (requiredByMaterial[bi.materialId] ?? 0) + need;
    }
  }

  const materialIds = Object.keys(requiredByMaterial);
  const stock = await prisma.stockItem.findMany({
    where: { materialId: { in: materialIds } },
    select: { materialId: true, quantity: true, reserved: true },
  });

  return NextResponse.json({ op, requiredByMaterial, stock });
}
