import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function requireRole(role: string | undefined, allowed: string[]) {
  return role && allowed.includes(role);
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Cadastro fiscal do produto -> ADMIN only
  if (!requireRole((session.user as { role?: string }).role, ["ADMIN"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const productId = ctx.params.id;

  const product = await prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null } as any,
    select: { id: true, name: true, code: true } as any,
  } as any);

  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const fiscal = await prisma.productFiscal.findUnique({
    where: { productId } as any,
    include: { ncm: true, cest: true, cfop: true, cst: true, csosn: true, taxProfile: true } as any,
  } as any);

  return NextResponse.json({ product, fiscal });
}

export async function PUT(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!requireRole((session.user as { role?: string }).role, ["ADMIN"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const productId = ctx.params.id;

  const product = await prisma.product.findFirst({
    where: { id: productId, companyId, deletedAt: null } as any,
    select: { id: true } as any,
  } as any);

  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as any;

  const origin = Number(body?.origin ?? 0);
  const ncmId = body?.ncmId ? String(body.ncmId) : null;
  const cestId = body?.cestId ? String(body.cestId) : null;
  const cfopId = body?.cfopId ? String(body.cfopId) : null;
  const cstId = body?.cstId ? String(body.cstId) : null;
  const csosnId = body?.csosnId ? String(body.csosnId) : null;
  const taxProfileId = body?.taxProfileId ? String(body.taxProfileId) : null;

  if (!Number.isFinite(origin) || origin < 0 || origin > 8) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 400 });
  }

  if (cstId && csosnId) {
    return NextResponse.json({ error: "cst_and_csosn_conflict" }, { status: 400 });
  }

  const fiscal = await prisma.productFiscal.upsert({
    where: { productId } as any,
    update: { origin, ncmId, cestId, cfopId, cstId, csosnId, taxProfileId } as any,
    create: { productId, origin, ncmId, cestId, cfopId, cstId, csosnId, taxProfileId } as any,
    include: { ncm: true, cest: true, cfop: true, cst: true, csosn: true, taxProfile: true } as any,
  } as any);

  return NextResponse.json({ ok: true, fiscal });
}
