import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const orderId = String(ctx.params.id);

  const o = await prisma.order.findFirst({
    where: {
      id: orderId,
      companyId,
      deletedAt: null,
    } as any,
    include: {
      client: { select: { id: true, name: true, document: true, phone: true, email: true } } as any,
      items: {
        orderBy: [{ createdAt: "asc" }] as any,
      } as any,
      accountsReceivable: {
        orderBy: [{ createdAt: "desc" }] as any,
        take: 1,
        select: {
          id: true,
          status: true,
          dueDate: true,
          amount: true,
          paidAt: true,
          paidAmount: true,
          createdAt: true,
        } as any,
      } as any,
    } as any,
  } as any);

  if (!o?.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const items = ((o as any).items ?? []).map((it: any) => ({
    id: it.id,
    productId: it.productId ?? null,
    description: it.description ?? it.name ?? null,
    qty: n(it.qty ?? it.quantity ?? 0),
    unitPrice: n(it.unitPrice ?? it.price ?? 0),
    total: n(it.total ?? 0),
  }));

  const total = items.reduce((s: number, it: any) => s + n(it.total), 0);

  const ar = Array.isArray((o as any).accountsReceivable) ? (o as any).accountsReceivable[0] ?? null : null;

  const lastInvoice = await prisma.fiscalInvoice.findFirst({
    where: { companyId, orderId } as any,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }] as any,
    select: {
      id: true,
      docType: true,
      model: true,
      status: true,
      key: true,
      number: true,
      serie: true,
      createdAt: true,
    } as any,
  } as any);

  return NextResponse.json({
    order: {
      id: o.id,
      number: o.number ?? null,
      status: o.status,
      createdAt: o.createdAt,
      sentToCashierAt: (o as any).sentToCashierAt ?? null,
      requestedDocType: (o as any).requestedDocType ?? null,
      paymentMethod: (o as any).paymentMethod ?? null,
      cardBrand: (o as any).cardBrand ?? null,
      installments: (o as any).installments ?? null,
      paymentNote: (o as any).paymentNote ?? null,
      client: (o as any).client
        ? {
            id: (o as any).client.id,
            name: (o as any).client.name,
            document: (o as any).client.document ?? null,
            phone: (o as any).client.phone ?? null,
            email: (o as any).client.email ?? null,
          }
        : null,
      items,
      total,
      ar,
      lastInvoice: lastInvoice ?? null,
    },
  });
}
