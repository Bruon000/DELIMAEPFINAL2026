import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function num(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;
  const role = String((session.user as any)?.role ?? "");

  const url = new URL(req.url);
  const vendedorIdFilter = url.searchParams.get("vendedorId")?.trim() || null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    if (role === "VENDEDOR") {
      const [ordersMonth, ordersToday, awaitingCashier, revenueMonth, recentOrders] = await Promise.all([
        prisma.order.count({
          where: { companyId, createdById: userId, createdAt: { gte: startOfMonth }, status: { not: "CANCELED" }, deletedAt: null },
        }),
        prisma.order.count({
          where: { companyId, createdById: userId, createdAt: { gte: startOfDay }, deletedAt: null },
        }),
        prisma.order.count({
          where: { companyId, createdById: userId, status: { in: ["OPEN"] } as any, sentToCashierAt: { not: null }, deletedAt: null } as any,
        }),
        prisma.accountsReceivable.aggregate({
          where: {
            companyId,
            status: "PAID" as any,
            paidAt: { gte: startOfMonth },
            order: { createdById: userId },
          } as any,
          _sum: { amount: true },
        }),
        prisma.order.findMany({
          where: { companyId, createdById: userId, deletedAt: null } as any,
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { client: { select: { name: true } } },
        }),
      ]);

      return NextResponse.json({
        role: "VENDEDOR",
        ordersMonth,
        ordersToday,
        awaitingCashier,
        revenueMonth: num(revenueMonth._sum.amount),
        recentOrders: recentOrders.map((o: any) => ({
          id: o.id,
          number: o.number,
          status: o.status,
          client: o.client?.name ?? "—",
          createdAt: o.createdAt,
        })),
      });
    }

    if (role === "CAIXA") {
      const [queueCount, confirmedToday, receivedToday, invoicesToday] = await Promise.all([
        prisma.order.count({
          where: { companyId, status: { in: ["DRAFT", "OPEN"] } as any, sentToCashierAt: { not: null }, deletedAt: null } as any,
        }),
        prisma.order.count({
          where: { companyId, status: "CONFIRMED" as any, confirmedAt: { gte: startOfDay }, deletedAt: null } as any,
        }),
        prisma.accountsReceivable.aggregate({
          where: { companyId, status: "PAID" as any, paidAt: { gte: startOfDay } } as any,
          _sum: { amount: true },
        }),
        prisma.fiscalInvoice.count({
          where: { companyId, status: "AUTHORIZED", createdAt: { gte: startOfDay } } as any,
        }),
      ]);

      return NextResponse.json({
        role: "CAIXA",
        queueCount,
        confirmedToday,
        receivedToday: num(receivedToday._sum.amount),
        invoicesToday,
      });
    }

    // ADMIN (e demais roles): base globais, opcionalmente filtradas por vendedor
    const orderWhereBase = {
      companyId,
      createdAt: { gte: startOfMonth },
      status: { not: "CANCELED" },
      deletedAt: null,
      ...(vendedorIdFilter ? { createdById: vendedorIdFilter } : {}),
    } as any;
    const arWhereBase = {
      companyId,
      status: "PAID" as any,
      paidAt: { gte: startOfMonth },
      ...(vendedorIdFilter ? { order: { createdById: vendedorIdFilter } } : {}),
    } as any;

    const [ordersMonth, revenueMonth, openPOs, cashBalance, criticalStock, vendedoresList, caixaDetail] = await Promise.all([
      prisma.order.count({ where: orderWhereBase }),
      prisma.accountsReceivable.aggregate({
        where: arWhereBase,
        _sum: { amount: true },
      }),
      prisma.productionOrder.count({
        where: { companyId, status: { in: ["QUEUED", "IN_PROGRESS", "BLOCKED"] } } as any,
      }),
      (async () => {
        const sess = await prisma.cashSession.findFirst({
          where: { companyId, closedAt: null } as any,
          orderBy: { openedAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        });
        if (!sess) return 0;
        const sum = await prisma.cashTransaction.aggregate({
          where: { sessionId: sess.id },
          _sum: { amount: true },
        });
        return num(sum._sum.amount) + num((sess as any).openingBalance);
      })(),
      prisma.stockItem.findMany({
        where: { material: { companyId, minStock: { not: null } } } as any,
        include: { material: true },
      }).then((items) =>
        items.filter((i) => i.material.minStock != null && num(i.quantity) < num(i.material.minStock)).length
      ),
      // Lista de vendedores (usuários com role VENDEDOR que têm pedidos) com métricas do mês
      prisma.user.findMany({
        where: { companyId, deletedAt: null, role: "VENDEDOR" } as any,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }).then(async (users) => {
        const list = await Promise.all(
          users.map(async (u) => {
            const [ordersMonthU, revenueMonthU, ordersTodayU] = await Promise.all([
              prisma.order.count({
                where: { companyId, createdById: u.id, createdAt: { gte: startOfMonth }, status: { not: "CANCELED" }, deletedAt: null },
              }),
              prisma.accountsReceivable.aggregate({
                where: { companyId, status: "PAID" as any, paidAt: { gte: startOfMonth }, order: { createdById: u.id } } as any,
                _sum: { amount: true },
              }),
              prisma.order.count({
                where: { companyId, createdById: u.id, createdAt: { gte: startOfDay }, deletedAt: null },
              }),
            ]);
            return {
              id: u.id,
              name: u.name,
              ordersMonth: ordersMonthU,
              revenueMonth: num(revenueMonthU._sum.amount),
              ordersToday: ordersTodayU,
            };
          })
        );
        return list;
      }),
      // Detalhe do caixa para admin: quem está com sessão aberta, totais do dia
      (async () => {
        const openSess = await prisma.cashSession.findFirst({
          where: { companyId, closedAt: null } as any,
          orderBy: { openedAt: "desc" },
          include: { user: { select: { id: true, name: true } } },
        });
        let todayIn = 0;
        let todayOut = 0;
        let balance = 0;
        if (openSess) {
          const opening = num((openSess as any).openingBalance);
          const txs = await prisma.cashTransaction.findMany({
            where: { sessionId: openSess.id },
            select: { type: true, amount: true, createdAt: true },
          });
          let sumIn = 0;
          let sumOut = 0;
          txs.forEach((t: any) => {
            const amt = num(t.amount);
            if (t.type === "IN") {
              sumIn += amt;
              if (new Date(t.createdAt) >= startOfDay) todayIn += amt;
            } else {
              sumOut += amt;
              if (new Date(t.createdAt) >= startOfDay) todayOut += amt;
            }
          });
          balance = opening + sumIn - sumOut;
        }
        const closedCount = await prisma.cashSession.count({
          where: { companyId, closedAt: { not: null } } as any,
        });
        return {
          openSession: openSess
            ? {
                sessionId: openSess.id,
                userId: (openSess as any).userId,
                userName: (openSess as any).user?.name ?? "—",
                openedAt: (openSess as any).openedAt,
                balance,
              }
            : null,
          todayIn,
          todayOut,
          closedSessionsCount: closedCount,
        };
      })(),
    ]);

    return NextResponse.json({
      role: "ADMIN",
      ordersThisMonth: ordersMonth,
      revenueThisMonth: num(revenueMonth._sum.amount),
      openProductionOrders: openPOs,
      cashBalance,
      criticalStockCount: criticalStock,
      vendedorIdFilter: vendedorIdFilter || undefined,
      vendedores: vendedoresList,
      caixaDetail,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({
      role,
      ordersThisMonth: 0,
      revenueThisMonth: 0,
      openProductionOrders: 0,
      cashBalance: 0,
      criticalStockCount: 0,
      vendedores: [],
      caixaDetail: { openSession: null, todayIn: 0, todayOut: 0, closedSessionsCount: 0 },
    });
  }
}
