import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function n(v: any) {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

export async function GET(req: Request) {
  const gate = await requireRole(["ADMIN", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") ?? "").trim().toLowerCase();
  const take = Math.min(Number(url.searchParams.get("take") ?? 80), 200);

  const rows = await prisma.order.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "DRAFT" as any,
      sentToCashierAt: { not: null } as any,
    } as any,
    orderBy: [{ sentToCashierAt: "desc" }, { createdAt: "desc" }] as any,
    include: {
      client: { select: { id: true, name: true, document: true } } as any,
      items: { select: { total: true } } as any,
    },
    take,
  } as any);

  const list = (rows ?? [])
    .map((o: any) => ({
      id: o.id,
      number: o.number ?? null,
      createdAt: o.createdAt,
      sentToCashierAt: o.sentToCashierAt,
      status: o.status,
      client: o.client ? { id: o.client.id, name: o.client.name, document: o.client.document ?? null } : null,
      total: (o.items ?? []).reduce((s: number, it: any) => s + n(it.total), 0),
      requestedDocType: (o as any).requestedDocType ?? null,
      paymentMethod: (o as any).paymentMethod ?? null,
      cardBrand: (o as any).cardBrand ?? null,
      installments: (o as any).installments ?? null,
      paymentNote: (o as any).paymentNote ?? null,
    }))
    .filter((o: any) => {
      if (!q) return true;
      const id = String(o.id ?? "").toLowerCase();
      const num = String(o.number ?? "").toLowerCase();
      const cname = String(o.client?.name ?? "").toLowerCase();
      const cdoc = String(o.client?.document ?? "").toLowerCase();
      return id.includes(q) || num.includes(q) || cname.includes(q) || cdoc.includes(q);
    });

  return NextResponse.json({ orders: list });
}
