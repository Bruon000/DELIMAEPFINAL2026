import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const productId = ctx.params.id;

  const product = await prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null },
    include: {
      bom: {
        include: {
          items: { include: { material: { select: { id: true, name: true, code: true, currentCost: true } } } },
        },
      },
    },
  } as any);

  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bom = (product as any).bom;
  if (!bom?.items?.length) {
    // Se não tiver BOM, custo vira 0 (ou mantém). Aqui vamos manter e informar.
    return NextResponse.json({ ok: false, error: "no_bom", costPrice: product.costPrice ?? null }, { status: 400 });
  }

  const lossGlobal = n(bom.lossPercent) / 100;

  let total = 0;
  const rows = [];

  for (const it of bom.items) {
    const qtyBase = n(it.quantity);
    const lossItem = n(it.lossPercent) / 100;
    const qtyFinal = qtyBase * (1 + lossGlobal) * (1 + lossItem);

    const unitCost = n(it.material?.currentCost);
    const line = qtyFinal * unitCost;

    total += line;

    rows.push({
      materialId: it.materialId,
      name: it.material?.name ?? it.materialId,
      code: it.material?.code ?? null,
      qtyBase,
      lossItemPercent: n(it.lossPercent),
      lossGlobalPercent: n(bom.lossPercent),
      qtyFinal,
      unitCost,
      line,
    });
  }

  // grava com 4 casas (padrão industrial)
  const totalFixed = Number(total.toFixed(4));

  const updated = await prisma.product.update({
    where: { id: productId } as any,
    data: { costPrice: totalFixed } as any,
    select: { id: true, name: true, costPrice: true },
  } as any);

  return NextResponse.json({ ok: true, product: updated, costPrice: updated.costPrice, rows });
}
