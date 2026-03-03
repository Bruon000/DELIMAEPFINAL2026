import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

function round99(price: number) {
  // arredonda pra terminar em .99 (padrão varejo)
  if (!isFinite(price) || price <= 0) return 0;
  const i = Math.floor(price);
  const d = price - i;
  if (d <= 0.99) return Number((i + 0.99).toFixed(2));
  return Number((i + 1 + 0.99).toFixed(2));
}

function round05(price: number) {
  // arredonda para múltiplos de 0.50
  if (!isFinite(price) || price <= 0) return 0;
  return Number((Math.round(price * 2) / 2).toFixed(2));
}

function round01(price: number) {
  // 2 casas normal
  if (!isFinite(price) || price <= 0) return 0;
  return Number(price.toFixed(2));
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const productId = ctx.params.id;
  const body = await req.json().catch(() => ({}));

  const mode = String(body?.mode ?? "MARKUP").toUpperCase(); // MARKUP | MARGIN
  const rounding = String(body?.rounding ?? "99").toUpperCase(); // 99 | 05 | NONE

  const product = await prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null },
    select: { id: true, name: true, salePrice: true, costPrice: true, markup: true, type: true },
  } as any);

  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const cost = n(product.costPrice);
  if (cost <= 0) {
    return NextResponse.json({ error: "no_cost", costPrice: product.costPrice ?? null }, { status: 400 });
  }

  // markup padrão do produto (se existir)
  const markupPercent = body?.markupPercent !== undefined ? n(body.markupPercent) : n(product.markup);
  const marginPercent = body?.marginPercent !== undefined ? n(body.marginPercent) : 30; // default premium: 30% margem

  let raw = 0;
  if (mode === "MARGIN") {
    const m = marginPercent / 100;
    if (m >= 0.95) return NextResponse.json({ error: "invalid_margin" }, { status: 400 });
    raw = cost / (1 - m);
  } else {
    // MARKUP
    raw = cost * (1 + (markupPercent / 100));
  }

  let suggested = raw;
  if (rounding === "05") suggested = round05(raw);
  else if (rounding === "NONE") suggested = round01(raw);
  else suggested = round99(raw); // default .99

  return NextResponse.json({
    ok: true,
    product: { id: product.id, name: product.name, type: product.type },
    costPrice: cost,
    mode,
    markupPercent,
    marginPercent,
    rounding,
    suggestedSalePrice: suggested,
    rawSalePrice: Number(raw.toFixed(4)),
  });
}
