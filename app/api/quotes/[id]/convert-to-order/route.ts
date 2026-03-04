import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/**
 * POST /api/quotes/:id/convert-to-order
 * Converte um orçamento em Pedido DRAFT + itens.
 */
export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." }, { status: 401 });
  }

  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;
  const quoteId = ctx.params.id;

  const quote: any = await prisma.quote.findFirst({
    where: { id: quoteId, companyId, deletedAt: null } as any,
    include: { items: true },
  } as any);

  if (!quote) {
    return NextResponse.json({ ok: false, error: "not_found", message: "Orçamento não encontrado" }, { status: 404 });
  }

  if (!(quote.items?.length)) {
    return NextResponse.json({ ok: false, error: "empty_quote", message: "Orçamento sem itens." }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        companyId,
        clientId: quote.clientId,
        createdById: userId,
        status: "DRAFT" as any,
        notes: quote.notes ?? null,
        technicalNotes: null,
        subtotal: quote.subtotal as any,
        discount: quote.discount as any,
        total: quote.total as any,
      } as any,
      select: { id: true },
    } as any);

    for (const it of quote.items as any[]) {
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: it.productId,
          quantity: it.quantity as any,
          unitPrice: it.unitPrice as any,
          discount: it.discount as any,
          total: it.total as any,
          notes: it.notes ?? null,
        } as any,
      } as any);
    }

    // marca orçamento como APPROVED (opcional)
    await tx.quote.update({
      where: { id: quoteId } as any,
      data: { status: "APPROVED" as any } as any,
    } as any);

    return order.id;
  });

  return NextResponse.json({ ok: true, orderId: result }, { status: 201 });
}

