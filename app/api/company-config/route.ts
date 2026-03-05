import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;

  const company = await prisma.company.findFirst({
    where: { id: companyId } as any,
    select: { id: true, name: true, document: true, email: true, phone: true } as any,
  } as any);

  const fiscal = await prisma.fiscalConfig.findFirst({
    where: { companyId } as any,
    select: { id: true, companyId: true, regime: true, certSerial: true } as any,
  } as any);

  return NextResponse.json({ company, fiscal });
}

export async function PATCH(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const body = await req.json().catch(() => ({}));

  const name = body?.name !== undefined ? String(body.name ?? "").trim() : undefined;
  const document = body?.document !== undefined ? String(body.document ?? "").trim() : undefined;
  const email = body?.email !== undefined ? String(body.email ?? "").trim() : undefined;
  const phone = body?.phone !== undefined ? String(body.phone ?? "").trim() : undefined;

  const regime = body?.regime !== undefined ? String(body.regime ?? "").trim() : undefined;
  const certSerial = body?.certSerial !== undefined ? String(body.certSerial ?? "").trim() : undefined;

  if (name !== undefined && !name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const updatedCompany = await prisma.company.update({
    where: { id: companyId } as any,
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(document !== undefined ? { document: document || null } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
    } as any,
    select: { id: true, name: true, document: true, email: true, phone: true } as any,
  } as any);

  const updatedFiscal =
    regime !== undefined || certSerial !== undefined
      ? await prisma.fiscalConfig.upsert({
          where: { companyId } as any,
          update: {
            ...(regime !== undefined ? { regime: regime || null } : {}),
            ...(certSerial !== undefined ? { certSerial: certSerial || null } : {}),
          } as any,
          create: {
            companyId,
            regime: regime || null,
            certSerial: certSerial || null,
          } as any,
          select: { id: true, companyId: true, regime: true, certSerial: true } as any,
        } as any)
      : await prisma.fiscalConfig.findFirst({
          where: { companyId } as any,
          select: { id: true, companyId: true, regime: true, certSerial: true } as any,
        } as any);

  return NextResponse.json({ company: updatedCompany, fiscal: updatedFiscal ?? null });
}

