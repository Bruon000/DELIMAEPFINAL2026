import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const pos = await prisma.purchaseOrder.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { id: true, name: true } },
      items: { select: { id: true, quantity: true, total: true } },
    },
    take: 200,
  } as any);

  const list = pos.map((po: any) => ({
    id: po.id,
    status: po.status,
    supplier: po.supplier ? { id: po.supplier.id, name: po.supplier.name } : null,
    createdAt: po.createdAt,
    receivedAt: po.receivedAt ?? null,
    itemsCount: (po.items ?? []).length,
    total: (po.items ?? []).reduce((s: number, it: any) => s + n(it.total), 0),
  }));

  // Anexar nfeKey via FiscalInvoice.payload.purchaseOrderId (sem schema change)
  const invoices = await prisma.fiscalInvoice.findMany({
    where: { companyId, type: "NF-E" as any } as any,
    select: { key: true, payload: true } as any,
  } as any);

  const map: Record<string, string> = {};
  for (const inv of invoices ?? []) {
    const pid = (inv as any)?.payload?.purchaseOrderId;
    const key = (inv as any)?.key;
    if (pid && key) map[String(pid)] = String(key);
  }

  const enriched = (list ?? []).map((po: any) => ({
    ...po,
    nfeKey: map[String(po.id)] ?? null,
  }));

  return NextResponse.json({ purchaseOrders: enriched });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const body = await req.json().catch(() => null);
  const supplierId = String(body?.supplierId ?? "").trim();
  const notes = String(body?.notes ?? "").trim();

  if (!supplierId) return NextResponse.json({ error: "supplier_required" }, { status: 400 });

  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, companyId, deletedAt: null } } as any);
  if (!supplier) return NextResponse.json({ error: "supplier_not_found" }, { status: 404 });

  const po = await prisma.purchaseOrder.create({
    data: {
      companyId,
      supplierId,
      status: "DRAFT" as any,
      notes: notes || null,
    } as any,
    select: { id: true },
  } as any);

  return NextResponse.json({ id: po.id }, { status: 201 });
}
