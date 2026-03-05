import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;

  const id = ctx.params.id;
  const body = await req.json().catch(() => null);

  const data: any = {};
  if (body?.name != null) data.name = String(body.name).trim();
  if (body?.document != null) data.document = String(body.document).trim() || null;
  if (body?.email != null) data.email = String(body.email).trim() || null;
  if (body?.phone != null) data.phone = String(body.phone).trim() || null;

  if (body?.tradeName != null) data.tradeName = String(body.tradeName).trim() || null;
  if (body?.ie != null) data.ie = String(body.ie).trim() || null;
  if (body?.im != null) data.im = String(body.im).trim() || null;

  if (body?.addressStreet != null) data.addressStreet = String(body.addressStreet).trim() || null;
  if (body?.addressNumber != null) data.addressNumber = String(body.addressNumber).trim() || null;
  if (body?.addressDistrict != null) data.addressDistrict = String(body.addressDistrict).trim() || null;
  if (body?.addressCity != null) data.addressCity = String(body.addressCity).trim() || null;
  if (body?.addressState != null) data.addressState = String(body.addressState).trim() || null;
  if (body?.addressZip != null) data.addressZip = String(body.addressZip).trim() || null;
  if (body?.isActive != null) data.isActive = !!body.isActive;

  const client = await prisma.client.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!client) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updated = await prisma.client.update({
    where: { id } as any,
    data,
    select: {
      id: true,
      name: true,
      tradeName: true,
      document: true,
      ie: true,
      im: true,
      email: true,
      phone: true,
      addressStreet: true,
      addressNumber: true,
      addressDistrict: true,
      addressCity: true,
      addressState: true,
      addressZip: true,
      isActive: true,
    },
  } as any);

  return NextResponse.json({ client: updated });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;

  const id = ctx.params.id;

  const client = await prisma.client.findFirst({ where: { id, companyId, deletedAt: null } } as any);
  if (!client) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.client.update({
    where: { id } as any,
    data: { deletedAt: new Date(), isActive: false } as any,
  } as any);

  return NextResponse.json({ ok: true });
}
