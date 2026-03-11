import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function toDateOrNull(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session?.user?.companyId;
  const url = new URL(req.url);
  if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const status = String(url.searchParams.get("status") ?? "PENDING").toUpperCase();
  const dueFilter = String(url.searchParams.get("dueFilter") ?? "").toLowerCase(); // overdue | dueToday
  const q = String(url.searchParams.get("q") ?? "").trim().toLowerCase();
  const from = toDateOrNull(url.searchParams.get("from"));
  const to = toDateOrNull(url.searchParams.get("to"));
  const vendedorId = String(url.searchParams.get("vendedorId") ?? "").trim();

  const where: any = { companyId };
  if (status && status !== "ALL") where.status = status;
  if (from || to) {
    where.dueDate = where.dueDate ?? {};
    if (from) where.dueDate.gte = from;
    if (to) where.dueDate.lte = to;
  }
  if (dueFilter === "overdue") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    where.dueDate = where.dueDate ?? {};
    where.dueDate.lt = today;
    if (status === "ALL") where.status = "PENDING";
  } else if (dueFilter === "duetoday") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    where.dueDate = { gte: today, lt: tomorrow };
    if (status === "ALL") where.status = "PENDING";
  }
  if (vendedorId) where.order = { createdById: vendedorId };

  const orderBy = status === "PAID"
    ? { paidAt: "desc" as const }
    : { dueDate: "asc" as const };

  const ars = await prisma.accountsReceivable.findMany({
    where,
    orderBy,
    include: {
      order: {
        include: {
          client: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
      },
    },
    take: 500,
  } as any);

  const filtered = (ars ?? []).filter((ar: any) => {
    if (!q) return true;
    const id = String(ar.id ?? "").toLowerCase();
    const orderId = String(ar.orderId ?? "").toLowerCase();
    const clientName = String(ar?.order?.client?.name ?? "").toLowerCase();
    const orderNumber = String(ar?.order?.number ?? "").toLowerCase();
    const vendedor = String(ar?.order?.createdBy?.name ?? "").toLowerCase();
    return id.includes(q) || orderId.includes(q) || clientName.includes(q) || orderNumber.includes(q) || vendedor.includes(q);
  });

  const list = filtered.map((ar: any) => ({
    id: ar.id,
    orderId: ar.orderId,
    orderNumber: ar.order?.number ?? null,
    client: ar.order?.client ? { id: ar.order.client.id, name: ar.order.client.name } : null,
    createdBy: ar.order?.createdBy ? { id: ar.order.createdBy.id, name: ar.order.createdBy.name } : null,
    dueDate: ar.dueDate,
    amount: Number(ar.amount ?? 0),
    paidAmount: ar.paidAmount != null ? Number(ar.paidAmount) : null,
    status: ar.status,
    paidAt: ar.paidAt,
    createdAt: ar.createdAt,
  }));

  const vendedores = await prisma.user.findMany({
    where: { companyId, deletedAt: null, ordersCreated: { some: {} } } as any,
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  } as any).catch(() => []);

  return NextResponse.json({ ars: list, vendedores: vendedores ?? [] });
}

