import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { createPdfA4, drawHeader, drawLine, drawTableHeader, drawRow, drawTotals, drawText, ensureSpace } from "@/lib/pdf";

function ptOrderStatus(s: any) {
  const x = String(s ?? "").toUpperCase();
  const map: Record<string, string> = {
    DRAFT: "Rascunho",
    OPEN: "Aberto",
    CONFIRMED: "Confirmado",
    IN_PRODUCTION: "Em produção",
    READY: "Pronto",
    INSTALLED: "Instalado",
    DELIVERED: "Entregue",
    CANCELED: "Cancelado",
  };
  return (map[x] ?? x) || "—";
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR", "CAIXA", "CONTADOR", "PRODUCAO"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const id = String(ctx.params.id ?? "");

  const order = await prisma.order.findFirst({
    where: { id, companyId, deletedAt: null } as any,
    include: {
      client: { select: { id: true, name: true, document: true, phone: true, email: true } as any },
      items: {
        include: { product: { select: { id: true, name: true, code: true } } as any },
        orderBy: { createdAt: "asc" } as any,
      },
    },
  } as any);

  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const role = String((gate.session.user as any)?.role ?? "");
  const userId = String(gate.session.user!.id ?? "");

  if (role === "VENDEDOR" && String((order as any)?.createdById ?? "") !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId } as any,
    select: { name: true, document: true, phone: true, email: true } as any,
  } as any);

  const ctxPdf = await createPdfA4();

  const orderNumber = order.number ? String(order.number) : String(order.id);
  const createdAt = new Date(String(order.createdAt)).toLocaleString("pt-BR");
  const client = (order as any).client;

  const header = () => {
    drawHeader(ctxPdf, company ?? {}, "COMPROVANTE / PEDIDO");
    drawText(ctxPdf, `Pedido: ${orderNumber}`, 11);
    drawText(ctxPdf, `Status: ${ptOrderStatus(order.status)}`, 11);
    drawText(ctxPdf, `Data: ${createdAt}`, 11);
    ctxPdf.y -= 6;

    drawText(ctxPdf, "Cliente", 12, true);
    drawText(ctxPdf, `Nome: ${client?.name ?? "—"}`, 11);
    drawText(
      ctxPdf,
      `Doc: ${client?.document ?? "—"}  ·  Tel: ${client?.phone ?? "—"}  ·  Email: ${client?.email ?? "—"}`,
      10,
    );
    ctxPdf.y -= 6;
    drawText(ctxPdf, "Itens", 12, true);
    drawTableHeader(ctxPdf);
  };

  header();

  const rows = ((order as any).items ?? []).map((it: any) => ({
    name: it.product?.name ?? it.productId,
    code: it.product?.code ?? "",
    qty: Number(it.quantity ?? 0),
    unit: Number(it.unitPrice ?? 0),
    total: Number(it.total ?? (Number(it.quantity ?? 0) * Number(it.unitPrice ?? 0))),
  }));

  const subtotal = rows.reduce((s: number, it: any) => s + Number(it.total ?? 0), 0);
  const discount = Number(order.discount ?? 0);
  const total = Number(order.total ?? (subtotal - discount));

  for (const r of rows) {
    ensureSpace(ctxPdf, 26, () => header());
    drawRow(ctxPdf, r);
  }

  drawTotals(ctxPdf, subtotal, discount, total);

  ensureSpace(ctxPdf, 40);
  ctxPdf.y -= 6;
  drawLine(ctxPdf);
  drawText(ctxPdf, "Assinatura do cliente: ________________________________", 11);
  drawText(ctxPdf, "Observação: valores/condições podem variar conforme medição e conferência.", 9);

  const pdfBytes = await ctxPdf.pdf.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pedido-${order.number ?? order.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
