import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;

  const clients = await prisma.client.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
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
    take: 500,
  });

  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const document = String(body?.document ?? "").trim();
  const email = String(body?.email ?? "").trim();
  const phone = String(body?.phone ?? "").trim();

const tradeName = String(body?.tradeName ?? "").trim();
const ie = String(body?.ie ?? "").trim();
const im = String(body?.im ?? "").trim();

const addressStreet = String(body?.addressStreet ?? "").trim();
const addressNumber = String(body?.addressNumber ?? "").trim();
const addressDistrict = String(body?.addressDistrict ?? "").trim();
const addressCity = String(body?.addressCity ?? "").trim();
const addressState = String(body?.addressState ?? "").trim();
const addressZip = String(body?.addressZip ?? "").trim();if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const client = await prisma.client.create({
    data: {
      id: `cli_${Date.now()}`,
      companyId,
      name,
      document: document || null,
      email: email || null,
      phone: phone || null,
      tradeName: tradeName || null,
ie: ie || null,
im: im || null,
addressStreet: addressStreet || null,
addressNumber: addressNumber || null,
addressDistrict: addressDistrict || null,
addressCity: addressCity || null,
addressState: addressState || null,
addressZip: addressZip || null,
isActive: true,} as any,
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

  return NextResponse.json({ client }, { status: 201 });
}


