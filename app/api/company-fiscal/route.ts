import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;

  const row = await prisma.companyFiscal.findUnique({
    where: { companyId } as any,
  } as any);

  return NextResponse.json({ fiscal: row ?? null });
}

export async function PATCH(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const body = await req.json().catch(() => ({}));

  // upsert pra nunca dar "not found"
  const row = await prisma.companyFiscal.upsert({
    where: { companyId } as any,
    create: {
      companyId,
      legalName: body?.legalName ?? null,
      tradeName: body?.tradeName ?? null,
      ie: body?.ie ?? null,
      crt: body?.crt != null ? Number(body.crt) : null,
      addressStreet: body?.addressStreet ?? null,
      addressNumber: body?.addressNumber ?? null,
      addressDistrict: body?.addressDistrict ?? null,
      addressCity: body?.addressCity ?? null,
      addressState: body?.addressState ?? null,
      addressZip: body?.addressZip ?? null,
      cityCodeIbge: body?.cityCodeIbge ?? null,
    } as any,
    update: {
      legalName: body?.legalName ?? null,
      tradeName: body?.tradeName ?? null,
      ie: body?.ie ?? null,
      crt: body?.crt != null ? Number(body.crt) : null,
      addressStreet: body?.addressStreet ?? null,
      addressNumber: body?.addressNumber ?? null,
      addressDistrict: body?.addressDistrict ?? null,
      addressCity: body?.addressCity ?? null,
      addressState: body?.addressState ?? null,
      addressZip: body?.addressZip ?? null,
      cityCodeIbge: body?.cityCodeIbge ?? null,
      updatedAt: new Date(),
    } as any,
  } as any);

  return NextResponse.json({ ok: true, fiscal: row });
}
