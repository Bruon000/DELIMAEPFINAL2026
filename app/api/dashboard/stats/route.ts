import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      ordersThisMonth,
      openProductionOrders,
      cashBalance,
      criticalStock,
    ] = await Promise.all([
      prisma.order.count({
        where: {
          createdAt: { gte: startOfMonth },
          status: { not: "CANCELED" },
        },
      }),
      prisma.productionOrder.count({
        where: {
          status: { in: ["QUEUED", "IN_PROGRESS", "BLOCKED"] },
        },
      }),
      (async () => {
        const session = await prisma.cashSession.findFirst({
          where: { closedAt: null },
          orderBy: { openedAt: "desc" },
        });
        if (!session) return 0;
        const sum = await prisma.cashTransaction.aggregate({
          where: { sessionId: session.id },
          _sum: { amount: true },
        });
        return Number(sum._sum.amount ?? 0) + Number(session.openingBalance);
      })(),
      prisma.stockItem.findMany({
        where: {
          material: {
            minStock: { not: null },
          },
        },
        include: { material: true },
      }).then((items) =>
        items.filter(
          (i) =>
            i.material.minStock != null &&
            i.quantity < i.material.minStock
        ).length
      ),
    ]);

    const revenueThisMonth = await prisma.accountsReceivable.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    });

    return NextResponse.json({
      ordersThisMonth,
      revenueThisMonth: Number(revenueThisMonth._sum.amount ?? 0),
      openProductionOrders,
      cashBalance,
      criticalStockCount: criticalStock,
    });
  } catch (e) {
    console.error(e);
    // Fallback para quando o banco ainda não está configurado (esqueleto do projeto)
    return NextResponse.json({
      ordersThisMonth: 0,
      revenueThisMonth: 0,
      openProductionOrders: 0,
      cashBalance: 0,
      criticalStockCount: 0,
    });
  }
}
