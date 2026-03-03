import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }
function pct(a: number, b: number) { return b === 0 ? 0 : (a / b) * 100; }

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session.user.companyId as string;

  const products = await prisma.product.findMany({
    where: { companyId, deletedAt: null, isActive: true },
    select: { id: true, name: true, code: true, type: true, salePrice: true, costPrice: true },
    orderBy: { name: "asc" },
  } as any);

  const rows = (products ?? []).map((p: any) => {
    const sale = n(p.salePrice);
    const cost = n(p.costPrice);
    const margin = sale - cost;
    const marginPct = pct(margin, sale);
    return {
      id: p.id,
      name: p.name,
      code: p.code ?? null,
      type: p.type ?? null,
      salePrice: sale,
      costPrice: cost,
      margin,
      marginPct: Number(marginPct.toFixed(2)),
      status:
        sale <= 0 ? "NO_PRICE" :
        cost <= 0 ? "NO_COST" :
        margin < 0 ? "NEGATIVE" :
        marginPct < 10 ? "LOW" :
        "OK",
    };
  });

  // rankings úteis pro dashboard
  const withPrice = rows.filter(r => r.salePrice > 0);
  const topMarginPct = [...withPrice].sort((a,b) => b.marginPct - a.marginPct).slice(0, 5);
  const worstMarginPct = [...withPrice].sort((a,b) => a.marginPct - b.marginPct).slice(0, 5);

  return NextResponse.json({ rows, topMarginPct, worstMarginPct });
}
