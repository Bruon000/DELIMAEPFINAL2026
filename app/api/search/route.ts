import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const companyId = session.user.companyId as string;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) return NextResponse.json({ q, results: [] });

  const take = 8;

  const [clients, products, orders, ops] = await Promise.all([
    prisma.client.findMany({
      where: { companyId, deletedAt: null, name: { contains: q, mode: "insensitive" } as any },
      select: { id: true, name: true },
      take,
    } as any),

    prisma.product.findMany({
      where: {
        companyId,
        deletedAt: null,
        isActive: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } as any },
          { code: { contains: q, mode: "insensitive" } as any },
        ],
      },
      select: { id: true, name: true, code: true },
      take,
    } as any),

    prisma.order.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { id: { contains: q, mode: "insensitive" } as any },
          { number: { contains: q, mode: "insensitive" } as any },
        ],
      },
      select: { id: true, status: true, number: true },
      take,
    } as any),

    prisma.productionOrder.findMany({
      where: {
        companyId,
        OR: [{ id: { contains: q, mode: "insensitive" } as any }],
      },
      select: { id: true, status: true, orderId: true },
      take,
    } as any),
  ]);

  const results = [
    ...clients.map((c) => ({ type: "client", title: c.name, href: `/clientes`, meta: c.id })),
    ...products.map((p) => ({ type: "product", title: `${p.code ? p.code + " - " : ""}${p.name}`, href: `/cadastros`, meta: p.id })),
    ...orders.map((o) => ({ type: "order", title: `Pedido ${o.number ?? o.id}`, href: `/pedidos/${o.id}`, meta: o.status })),
    ...ops.map((op) => ({ type: "op", title: `OP ${op.id}`, href: `/producao/ops/${op.id}`, meta: op.status })),
  ];

  return NextResponse.json({ q, results });
}
