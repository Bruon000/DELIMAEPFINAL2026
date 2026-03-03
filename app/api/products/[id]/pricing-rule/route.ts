import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

function normMode(x: any) {
  const v = String(x ?? "").toUpperCase().trim();
  if (v === "MARKUP" || v === "MARGIN") return v;
  return null;
}
function normRounding(x: any) {
  const v = String(x ?? "").toUpperCase().trim();
  if (v === "R99" || v === "99") return "R99";
  if (v === "R05" || v === "05") return "R05";
  if (v === "NONE") return "NONE";
  return null;
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const productId = ctx.params.id;

  const rule = await prisma.productPricingRule.findFirst({
    where: { companyId, productId },
  } as any);

  return NextResponse.json({ pricingRule: rule ?? null });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const productId = ctx.params.id;
  const body = await req.json().catch(() => ({}));

  const mode = normMode(body?.mode);
  const rounding = normRounding(body?.rounding);

  if (!mode || !rounding) {
    return NextResponse.json({ error: "missing_pricing_params" }, { status: 400 });
  }

  const overheadPercent = body?.overheadPercent !== undefined ? n(body.overheadPercent) : null;
  const feesPercent = body?.feesPercent !== undefined ? n(body.feesPercent) : null;

  const marginPercent = body?.marginPercent !== undefined ? n(body.marginPercent) : null;
  const markupPercent = body?.markupPercent !== undefined ? n(body.markupPercent) : null;

  if (mode === "MARGIN" && (marginPercent === null || !isFinite(marginPercent) || marginPercent <= 0)) {
    return NextResponse.json({ error: "missing_margin_percent" }, { status: 400 });
  }
  if (mode === "MARKUP" && (markupPercent === null || !isFinite(markupPercent) || markupPercent < 0)) {
    return NextResponse.json({ error: "missing_markup_percent" }, { status: 400 });
  }

  const rule = await prisma.productPricingRule.upsert({
    where: { productId } as any,
    update: {
      companyId,
      mode,
      rounding,
      overheadPercent,
      feesPercent,
      marginPercent: mode === "MARGIN" ? marginPercent : null,
      markupPercent: mode === "MARKUP" ? markupPercent : null,
    } as any,
    create: {
      companyId,
      productId,
      mode,
      rounding,
      overheadPercent,
      feesPercent,
      marginPercent: mode === "MARGIN" ? marginPercent : null,
      markupPercent: mode === "MARKUP" ? markupPercent : null,
    } as any,
  } as any);

  return NextResponse.json({ pricingRule: rule });
}

export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const productId = ctx.params.id;

  const existing = await prisma.productPricingRule.findFirst({ where: { companyId, productId } } as any);
  if (!existing) return NextResponse.json({ ok: true, deleted: true });

  await prisma.productPricingRule.delete({ where: { id: existing.id } } as any);
  return NextResponse.json({ ok: true, deleted: true });
}
