import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { createPdfA4, drawHeader, drawLine, drawTableHeader, drawRow, drawTotals, drawText, ensureSpace } from "@/lib/pdf";

function ptQuoteStatus(s: any) {
  const x = String(s ?? "").toUpperCase();
  const map: Record<string, string> = {
    DRAFT: "Rascunho",
    SENT: "Enviado",
    APPROVED: "Aprovado",
    REJECTED: "Rejeitado",
    EXPIRED: "Vencido",
    CANCELED: "Cancelado",
  };
  return (map[x] ?? x) || "—";
}

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const gate = await requireRole(["ADMIN", "VENDEDOR", "CAIXA", "CONTADOR", "PRODUCAO"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const id = String(ctx.params.id ?? "");

  const quote = await prisma.quote.findFirst({
    where: { id, companyId, deletedAt: null } as any,
    include: {
      client: { select: { id: true, name: true, document: true, phone: true, email: true } as any },
      items: {
        include: { product: { select: { id: true, name: true, code: true } } as any },
        orderBy: { createdAt: "asc" } as any,
      },
    },
  } as any);

  if (!quote) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const role = String((gate.session.user as any)?.role ?? "");
  const userId = String(gate.session.user!.id ?? "");

  // Quote tem createdById (pelo schema). Se vier null, só ADMIN pode imprimir.
  const createdById = String((quote as any)?.createdById ?? "");
  if (role === "VENDEDOR" && (!createdById || createdById !== userId)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId } as any,
    select: { name: true, document: true, phone: true, email: true } as any,
  } as any);

  const ctxPdf = await createPdfA4();
  const quoteNumber = quote.number ? String(quote.number) : String(quote.id);
  const createdAt = new Date(String(quote.createdAt)).toLocaleString("pt-BR");
  const validUntil = quote.validUntil ? new Date(String(quote.validUntil)).toLocaleDateString("pt-BR") : "—";
  const client = (quote as any).client;

  const header = () => {
    drawHeader(ctxPdf, company ?? {}, "ORÇAMENTO");
    drawText(ctxPdf, `Orçamento: ${quoteNumber}`, 11);
    drawText(ctxPdf, `Status: ${ptQuoteStatus(quote.status)}`, 11);
    drawText(ctxPdf, `Criado: ${createdAt}`, 11);
    drawText(ctxPdf, `Validade: ${validUntil}`, 11);
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

  const rows = ((quote as any).items ?? []).map((it: any) => ({
    name: it.product?.name ?? it.productId,
    code: it.product?.code ?? "",
    qty: Number(it.quantity ?? 0),
    unit: Number(it.unitPrice ?? 0),
    total: Number(it.total ?? (Number(it.quantity ?? 0) * Number(it.unitPrice ?? 0))),
  }));

  const subtotal = rows.reduce((s: number, it: any) => s + Number(it.total ?? 0), 0);
  const discount = Number(quote.discount ?? 0);
  const total = Number(quote.total ?? (subtotal - discount));

  for (const r of rows) {
    ensureSpace(ctxPdf, 26, () => header());
    drawRow(ctxPdf, r);
  }

  drawTotals(ctxPdf, subtotal, discount, total);

  ensureSpace(ctxPdf, 40);
  ctxPdf.y -= 6;
  drawLine(ctxPdf);
  drawText(ctxPdf, "Validade: após vencido, apenas o Admin pode destravar.", 9);
  drawText(ctxPdf, "Assinatura: __________________________________________", 11);

  const pdfBytes = await ctxPdf.pdf.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="orcamento-${quote.number ?? quote.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
