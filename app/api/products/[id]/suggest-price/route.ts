import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

function round99(price: number) {
  if (!isFinite(price) || price <= 0) return 0;
  const i = Math.floor(price);
  const d = price - i;
  if (d <= 0.99) return Number((i + 0.99).toFixed(2));
  return Number((i + 1 + 0.99).toFixed(2));
}
function round05(price: number) {
  if (!isFinite(price) || price <= 0) return 0;
  return Number((Math.round(price * 2) / 2).toFixed(2));
}
function round01(price: number) {
  if (!isFinite(price) || price <= 0) return 0;
  return Number(price.toFixed(2));
}

function normMode(x: any) {
  const v = String(x ?? "").toUpperCase().trim();
  if (v === "MARKUP" || v === "MARGIN") return v;
  return null;
}

function normRounding(x: any) {
  const v = String(x ?? "").toUpperCase().trim();
  if (v === "99" || v === "R99") return "R99";
  if (v === "05" || v === "R05") return "R05";
  if (v === "NONE") return "NONE";
  return null;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const productId = ctx.params.id;
  const body = await req.json().catch(() => ({}));

  // ✅ MANUAL: UI deve mandar os parâmetros (sem defaults escondidos)
  const mode = normMode(body?.mode);
  const rounding = normRounding(body?.rounding);

  if (!mode || !rounding) {
    return NextResponse.json({ error: "missing_pricing_params" }, { status: 400 });
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null },
    select: { id: true, name: true, costPrice: true, type: true },
  } as any);

  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const costBase = n(product.costPrice);
  if (costBase <= 0) {
    return NextResponse.json({ error: "no_cost", costPrice: product.costPrice ?? null }, { status: 400 });
  }

  const overheadPercent = body?.overheadPercent !== undefined ? n(body.overheadPercent) : 0;
  const feesPercent = body?.feesPercent !== undefined ? n(body.feesPercent) : 0;

  if (!isFinite(overheadPercent) || overheadPercent < 0) return NextResponse.json({ error: "invalid_overhead" }, { status: 400 });
  if (!isFinite(feesPercent) || feesPercent < 0) return NextResponse.json({ error: "invalid_fees" }, { status: 400 });

  // custo ajustado (premium): custo BOM + overhead + taxas
  const cost = costBase * (1 + (overheadPercent / 100)) * (1 + (feesPercent / 100));

  // percentuais manuais
  const markupPercent = body?.markupPercent !== undefined ? n(body.markupPercent) : undefined;
  let marginPercent = body?.marginPercent !== undefined ? n(body.marginPercent) : undefined;

  if (mode === "MARKUP") {
    if (markupPercent === undefined || !isFinite(markupPercent) || markupPercent < 0) {
      return NextResponse.json({ error: "missing_markup_percent" }, { status: 400 });
    }
  }

  if (mode === "MARGIN") {
    if (marginPercent === undefined || !isFinite(marginPercent) || marginPercent < 0) {
      return NextResponse.json({ error: "missing_margin_percent" }, { status: 400 });
    }

    const minMarginPercent = body?.minMarginPercent !== undefined ? n(body.minMarginPercent) : 0;
    if (!isFinite(minMarginPercent) || minMarginPercent < 0) {
      return NextResponse.json({ error: "invalid_min_margin" }, { status: 400 });
    }
    if (minMarginPercent > 0 && (marginPercent as number) < minMarginPercent) {
      marginPercent = minMarginPercent; // trava premium
    }
  }

  let raw = 0;

  if (mode === "MARGIN") {
    const m = (marginPercent as number) / 100;
    if (m >= 0.95) return NextResponse.json({ error: "invalid_margin" }, { status: 400 });
    raw = cost / (1 - m);
  } else {
    raw = cost * (1 + ((markupPercent as number) / 100));
  }

  let suggested = raw;
  if (rounding === "R05") suggested = round05(raw);
  else if (rounding === "NONE") suggested = round01(raw);
  else suggested = round99(raw);

  return NextResponse.json({
    ok: true,
    product: { id: product.id, name: product.name, type: product.type },
    costBase: Number(costBase.toFixed(4)),
    overheadPercent,
    feesPercent,
    costPrice: Number(cost.toFixed(4)),
    mode,
    markupPercent: mode === "MARKUP" ? Number((markupPercent as number).toFixed(2)) : null,
    marginPercent: mode === "MARGIN" ? Number((marginPercent as number).toFixed(2)) : null,
    rounding,
    suggestedSalePrice: suggested,
    rawSalePrice: Number(raw.toFixed(4)),
  });
}
