import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET(req: Request) {
  const gate = await requireRole(["ADMIN", "VENDEDOR", "PRODUCAO"]);
  if (!gate.ok) return gate.res;
  const companyId = gate.session.user!.companyId as string;
  const userId = gate.session.user!.id as string;
  const role = String(gate.session.user!.role ?? "");

  const url = new URL(req.url);
  const vendedorId = role === "ADMIN" ? url.searchParams.get("vendedorId")?.trim() || null : null;

  const orders = await prisma.order.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(role === "VENDEDOR" ? { createdById: userId } : vendedorId ? { createdById: vendedorId } : {}),
    } as any,
    orderBy: { createdAt: "desc" },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          addressStreet: true,
          addressNumber: true,
          addressDistrict: true,
          addressCity: true,
          addressState: true,
          addressZip: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          total: true,
          product: { select: { id: true, name: true, code: true } },
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
    take: 200,
  });

  const orderIds = orders.map((o) => o.id);

  const invoices = orderIds.length > 0
    ? await prisma.fiscalInvoice.findMany({
        where: { orderId: { in: orderIds }, companyId } as any,
        select: { orderId: true, status: true, docType: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const lastInvoiceMap = new Map<string, { status: string; docType: string }>();
  for (const inv of invoices) {
    if (inv.orderId && !lastInvoiceMap.has(inv.orderId)) {
      lastInvoiceMap.set(inv.orderId, { status: inv.status, docType: inv.docType });
    }
  }

  function buildTimeline(o: any) {
    const t: { label: string; date: string | null }[] = [];
    t.push({ label: "Criado", date: o.createdAt ? new Date(o.createdAt).toISOString() : null });
    if (o.sentToCashierAt) t.push({ label: "Enviado ao caixa", date: new Date(o.sentToCashierAt).toISOString() });
    if (o.confirmedAt) t.push({ label: "Confirmado", date: new Date(o.confirmedAt).toISOString() });
    const st = String(o.status ?? "");
    if (["IN_PRODUCTION", "READY", "DELIVERED"].includes(st)) {
      t.push({ label: st === "IN_PRODUCTION" ? "Em produção" : st === "READY" ? "Pronto" : "Entregue", date: o.confirmedAt ? new Date(o.confirmedAt).toISOString() : null });
    }
    return t;
  }

  function formatAddress(c: any) {
    if (!c) return null;
    const parts = [c.addressStreet, c.addressNumber, c.addressDistrict, c.addressCity, c.addressState, c.addressZip].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }

  const list = orders.map((o: any) => ({
    id: o.id,
    number: o.number ?? null,
    status: o.status,
    client: o.client ? { id: o.client.id, name: o.client.name } : null,
    createdAt: o.createdAt,
    sentToCashierAt: o.sentToCashierAt ?? null,
    confirmedAt: o.confirmedAt ?? null,
    requestedDocType: o.requestedDocType ?? null,
    lastInvoiceStatus: lastInvoiceMap.get(o.id)?.status ?? null,
    lastInvoiceDocType: lastInvoiceMap.get(o.id)?.docType ?? null,
    createdBy: o.createdBy ? { id: o.createdBy.id, name: o.createdBy.name } : null,
    total: (o.items ?? []).reduce((s: number, it: any) => s + Number(it.total ?? 0), 0),
    itemsCount: (o.items ?? []).length,
    notes: o.notes ?? null,
    deliveryAddress: formatAddress(o.client),
    items: (o.items ?? []).map((it: any) => ({
      id: it.id,
      productName: it.product?.name ?? null,
      productCode: it.product?.code ?? null,
      quantity: Number(it.quantity ?? 0),
      unitPrice: Number(it.unitPrice ?? 0),
      total: Number(it.total ?? 0),
    })),
    timeline: buildTimeline(o),
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

  if (notes.length > 500) {
    return NextResponse.json(
      { error: "notes_too_long", message: "Observação da nota deve ter no máximo 500 caracteres." },
      { status: 400 },
    );
  }

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

  if ((paymentNote ?? "").length > 500) {
    return NextResponse.json(
      { error: "payment_note_too_long", message: "Observação de pagamento deve ter no máximo 500 caracteres." },
      { status: 400 },
    );
  }

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
