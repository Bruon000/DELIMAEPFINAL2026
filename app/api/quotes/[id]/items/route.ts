import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

async function recalcQuote(tx: any, quoteId: string) {
  const items = await tx.quoteItem.findMany({
    where: { quoteId } as any,
    select: { total: true },
  } as any);
  const subtotal = items.reduce((s: number, it: any) => s + n(it.total), 0);
  await tx.quote.update({
    where: { id: quoteId } as any,
    data: { subtotal, total: subtotal } as any,
  } as any);
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }
  const companyId = session.user.companyId as string;
  const quoteId = ctx.params.id;

  const body = await req.json().catch(() => null);
  const productId = String(body?.productId ?? "").trim();
  const qty = n(body?.quantity);
  const unitPrice = n(body?.unitPrice);
  const notes = String(body?.notes ?? "").trim();

  if (!productId || qty <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_body", message: "Informe produto e quantidade." }, { status: 400 });
  }

  // valida quote pertence a empresa
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId, deletedAt: null } as any,
    select: { id: true, status: true },
  } as any);
  if (!quote) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Orçamento não encontrado" }, { status: 404 });
  }

  const total = qty * unitPrice;

  const result = await prisma.$transaction(async (tx) => {
    const item = await tx.quoteItem.create({
      data: {
        quoteId,
        productId,
        quantity: qty as any,
        unitPrice: unitPrice as any,
        discount: 0 as any,
        total: total as any,
        notes: notes || null,
      } as any,
      select: { id: true },
    } as any);

    await recalcQuote(tx, quoteId);
    return item;
  });

  return NextResponse.json({ ok: true, itemId: result.id }, { status: 201 });
}

export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }
  const companyId = session.user.companyId as string;
  const quoteId = ctx.params.id;

  const url = new URL(req.url);
  const itemId = String(url.searchParams.get("itemId") ?? "").trim();
  if (!itemId) {
    return NextResponse.json({ ok: false, error: "item_required", message: "Informe itemId." }, { status: 400 });
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId, deletedAt: null } as any,
    select: { id: true },
  } as any);
  if (!quote) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Orçamento não encontrado" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.quoteItem.deleteMany({
      where: { id: itemId, quoteId } as any,
    } as any);
    await recalcQuote(tx, quoteId);
    return true;
  });

  return NextResponse.json({ ok: true });
}

