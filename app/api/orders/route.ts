import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = String(gate.session.user!.role ?? "");

  const orders = await prisma.order.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(role === "VENDEDOR" ? { createdById: userId } : {}),
    } as any,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      items: { select: { id: true, quantity: true, unitPrice: true, total: true } },
    },
    take: 200,
  });

  const list = orders.map((o) => ({
    id: o.id,
    number: (o as any).number ?? null,
    status: o.status,
    client: o.client ? { id: o.client.id, name: o.client.name } : null,
    createdAt: o.createdAt,
    total: (o.items ?? []).reduce((s, it) => s + Number(it.total ?? 0), 0),
    itemsCount: (o.items ?? []).length,
  }));

  return NextResponse.json({ orders: list });
}

export async function POST(req: Request) {
  const gate = await requireRole(["ADMIN", "VENDEDOR"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;

  const body = await req.json().catch(() => null);
  const clientIdRaw = String(body?.clientId ?? "").trim();
  const walkIn = Boolean(body?.walkIn ?? false);
  const notes = String(body?.notes ?? "").trim();

  let clientId = clientIdRaw;
  if (!clientId && walkIn) {
    const walkin = await prisma.client.findFirst({
      where: { companyId, document: "WALKIN", deletedAt: null } as any,
      select: { id: true } as any,
    } as any);
    if (!walkin) return NextResponse.json({ error: "walkin_not_found" }, { status: 404 });
    clientId = String(walkin.id);
  }

  if (!clientId) return NextResponse.json({ error: "client_required" }, { status: 400 });

  const requestedDocType = body?.requestedDocType ? String(body.requestedDocType).toUpperCase() : null;
  const paymentMethod = body?.paymentMethod ? String(body.paymentMethod).toUpperCase() : null;
  const cardBrand = body?.cardBrand ? String(body.cardBrand).toUpperCase() : null;
  const installments = body?.installments != null ? Number(body.installments) : null;
  const sentToCashier = Boolean(body?.sentToCashier ?? false);
  const paymentNote = body?.paymentNote ? String(body.paymentNote).trim() : null;

  const order = await prisma.order.create({
    data: {
      id: `ord_${Date.now()}`,
      companyId,
      createdById: userId,
      clientId,
      notes: notes || null,
      status: "DRAFT" as any,
      sentToCashierAt: sentToCashier ? new Date() : null,
      requestedDocType: requestedDocType || null,
      paymentMethod: paymentMethod || null,
      cardBrand: cardBrand || null,
      installments: Number.isFinite(installments) ? installments : null,
      paymentNote: paymentNote || null,
    } as any,
    select: { id: true },
  });

  return NextResponse.json({ id: order.id }, { status: 201 });
}
