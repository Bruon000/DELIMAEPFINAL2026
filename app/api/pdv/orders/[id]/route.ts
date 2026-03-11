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
      client: {
        select: {
          id: true,
          name: true,
          tradeName: true,
          document: true,
          phone: true,
          email: true,
          addressStreet: true,
          addressNumber: true,
          addressDistrict: true,
          addressCity: true,
          addressState: true,
          addressZip: true,
          cityCodeIbge: true,
          ie: true,
          im: true,
        },
      } as any,
      items: {
        orderBy: [{ createdAt: "asc" }] as any,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              code: true,
              fiscal: {
                select: {
                  id: true,
                  origin: true,
                  ncm: { select: { code: true, description: true } },
                  cfop: { select: { code: true, description: true } },
                  cst: { select: { code: true, description: true } },
                  csosn: { select: { code: true, description: true } },
                  cest: { select: { code: true, description: true } },
                  taxProfile: { select: { name: true, description: true } },
                },
              },
            },
          },
        },
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
    description: it.description ?? it.name ?? it.product?.name ?? null,
    qty: n(it.qty ?? it.quantity ?? 0),
    unitPrice: n(it.unitPrice ?? it.price ?? 0),
    total: n(it.total ?? 0),
    product: it.product
      ? {
          id: it.product.id,
          name: it.product.name,
          code: it.product.code ?? null,
          fiscal: it.product.fiscal
            ? {
                hasFiscal: true,
                origin: it.product.fiscal.origin,
                ncm: it.product.fiscal.ncm?.code ?? null,
                cfop: it.product.fiscal.cfop?.code ?? null,
                cst: it.product.fiscal.cst?.code ?? null,
                csosn: it.product.fiscal.csosn?.code ?? null,
                cest: it.product.fiscal.cest?.code ?? null,
                taxProfile: it.product.fiscal.taxProfile?.name ?? null,
              }
            : null,
        }
      : null,
  }));

  const total = items.reduce((s: number, it: any) => s + n(it.total), 0);

  const ar = Array.isArray((o as any).accountsReceivable) ? (o as any).accountsReceivable[0] ?? null : null;

  const client = (o as any).client
    ? {
        id: (o as any).client.id,
        name: (o as any).client.name,
        tradeName: (o as any).client.tradeName ?? null,
        document: (o as any).client.document ?? null,
        phone: (o as any).client.phone ?? null,
        email: (o as any).client.email ?? null,
        addressStreet: (o as any).client.addressStreet ?? null,
        addressNumber: (o as any).client.addressNumber ?? null,
        addressDistrict: (o as any).client.addressDistrict ?? null,
        addressCity: (o as any).client.addressCity ?? null,
        addressState: (o as any).client.addressState ?? null,
        addressZip: (o as any).client.addressZip ?? null,
        cityCodeIbge: (o as any).client.cityCodeIbge ?? null,
        ie: (o as any).client.ie ?? null,
        im: (o as any).client.im ?? null,
      }
    : null;

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
      notes: (o as any).notes ?? null,
      client,
      items,
      total,
      ar,
      lastInvoice: lastInvoice ?? null,
    },
  });
}
