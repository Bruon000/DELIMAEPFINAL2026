import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const cfg = await prisma.pricingConfig.findFirst({ where: { companyId } } as any);
  return NextResponse.json({ pricingConfig: cfg ?? null });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const body = await req.json().catch(() => ({}));

  const defaultMode = body?.defaultMode ? String(body.defaultMode).toUpperCase() : undefined; // MARKUP | MARGIN
  const rounding = body?.rounding ? String(body.rounding).toUpperCase() : undefined;         // R99 | R05 | NONE

  const defaultMarginPercent = body?.defaultMarginPercent !== undefined ? n(body.defaultMarginPercent) : undefined;
  const defaultMarkupPercent = body?.defaultMarkupPercent !== undefined ? n(body.defaultMarkupPercent) : undefined;
  const minMarginPercent = body?.minMarginPercent !== undefined ? n(body.minMarginPercent) : undefined;
  const overheadPercent = body?.overheadPercent !== undefined ? n(body.overheadPercent) : undefined;
  const feesPercent = body?.feesPercent !== undefined ? n(body.feesPercent) : undefined;

  const badPct = (v: any) => v !== undefined && (!isFinite(v) || v < 0);
  if (badPct(defaultMarginPercent) || badPct(defaultMarkupPercent) || badPct(minMarginPercent) || badPct(overheadPercent) || badPct(feesPercent)) {
    return NextResponse.json({ error: "invalid_percent" }, { status: 400 });
  }
  if (defaultMode && !["MARKUP", "MARGIN"].includes(defaultMode)) return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  if (rounding && !["R99", "R05", "NONE"].includes(rounding)) return NextResponse.json({ error: "invalid_rounding" }, { status: 400 });

  const cfg = await prisma.pricingConfig.upsert({
    where: { companyId } as any,
    update: {
      ...(defaultMode ? { defaultMode } : {}),
      ...(rounding ? { rounding } : {}),
      ...(defaultMarginPercent !== undefined ? { defaultMarginPercent } : {}),
      ...(defaultMarkupPercent !== undefined ? { defaultMarkupPercent } : {}),
      ...(minMarginPercent !== undefined ? { minMarginPercent } : {}),
      ...(overheadPercent !== undefined ? { overheadPercent } : {}),
      ...(feesPercent !== undefined ? { feesPercent } : {}),
    } as any,
    create: {
      companyId,
      ...(defaultMode ? { defaultMode } : {}),
      ...(rounding ? { rounding } : {}),
      ...(defaultMarginPercent !== undefined ? { defaultMarginPercent } : {}),
      ...(defaultMarkupPercent !== undefined ? { defaultMarkupPercent } : {}),
      ...(minMarginPercent !== undefined ? { minMarginPercent } : {}),
      ...(overheadPercent !== undefined ? { overheadPercent } : {}),
      ...(feesPercent !== undefined ? { feesPercent } : {}),
    } as any,
  } as any);

  return NextResponse.json({ pricingConfig: cfg });
}
