import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { createPdfA4, drawHeader, drawLine, drawText, drawTableHeader, drawRow, drawTotals, ensureSpace } from "@/lib/pdf";

function requireRole(role: string | undefined, allowed: string[]) {
  return role && allowed.includes(role);
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function formatDocType(docType: string) {
  const t = (docType || "").toUpperCase();
  if (t === "NFE") return "NF-e (Modelo 55)";
  if (t === "NFCE") return "NFC-e (Modelo 65)";
  if (t === "CTE") return "CT-e";
  if (t === "MDFE") return "MDF-e";
  if (t === "NFSE") return "NFS-e";
  return t || "Documento Fiscal";
}

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!requireRole((session.user as { role?: string }).role, ["ADMIN", "CAIXA"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const id = ctx.params.id;

  const inv = await prisma.fiscalInvoice.findFirst({
    where: { id, companyId },
  });

  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // payload é o "contrato" plugável — usamos ele para renderizar
  const payload = (typeof inv.payload === "object" && inv.payload !== null ? inv.payload : {}) as Record<string, unknown>;
  const order = (payload.order ?? {}) as Record<string, unknown>;
  const client = (payload.client ?? null) as Record<string, unknown> | null;
  const items = Array.isArray(payload.items) ? payload.items : [];

  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { name: true, document: true, phone: true, email: true },
  });

  const ctxPdf = await createPdfA4();

  const title = `${formatDocType(inv.docType)} — PRÉVIA (SEM VALIDADE FISCAL)`;
  drawHeader(ctxPdf, company ?? {}, title);

  // Aviso forte
  drawText(ctxPdf, "ATENÇÃO: Este documento é uma PRÉVIA/RECIBO e NÃO possui validade fiscal (sem autorização SEFAZ).", 10, true);
  drawLine(ctxPdf);

  // Identificação
  drawText(ctxPdf, `ID: ${inv.id}`, 10);
  if (inv.orderId) drawText(ctxPdf, `Pedido: ${inv.orderId} ${order?.number ? `(nº ${order.number})` : ""}`, 10);
  drawText(ctxPdf, `Status (interno): ${inv.status ?? "—"}`, 10);
  ctxPdf.y -= 4;
  drawLine(ctxPdf);

  // Cliente
  drawText(ctxPdf, "Cliente", 12, true);
  if (client) {
    drawText(ctxPdf, `Nome: ${safeStr(client.name) || "—"}`, 10);
    if (client.tradeName) drawText(ctxPdf, `Nome fantasia: ${safeStr(client.tradeName)}`, 10);
    if (client.document) drawText(ctxPdf, `Documento: ${safeStr(client.document)}`, 10);
    if (client.ie) drawText(ctxPdf, `IE: ${safeStr(client.ie)}`, 10);
    if (client.im) drawText(ctxPdf, `IM: ${safeStr(client.im)}`, 10);
    if (client.email) drawText(ctxPdf, `Email: ${safeStr(client.email)}`, 10);
    if (client.phone) drawText(ctxPdf, `Telefone: ${safeStr(client.phone)}`, 10);

    const a = (client.address ?? {}) as Record<string, unknown>;
    const addrLine = [a.street, a.number ? `nº ${a.number}` : "", a.district, a.city, a.state, a.zip]
      .map((x) => safeStr(x))
      .filter(Boolean)
      .join(" · ");
    if (addrLine) drawText(ctxPdf, `Endereço: ${addrLine}`, 10);
    else if (a.raw) drawText(ctxPdf, `Endereço: ${safeStr(a.raw)}`, 10);
  } else {
    drawText(ctxPdf, "—", 10);
  }

  ctxPdf.y -= 2;
  drawLine(ctxPdf);

  // Itens
  drawText(ctxPdf, "Itens", 12, true);
  drawTableHeader(ctxPdf);

  let subtotal = Number(order?.subtotal ?? order?.total ?? 0);
  let discount = Number(order?.discount ?? 0);
  let total = Number(order?.total ?? 0);

  // Se não tiver totals no payload, recalcula pelo array
  if (!Number.isFinite(total) || total <= 0) {
    const sum = items.reduce((acc: number, it: Record<string, unknown>) => acc + Number(it.total ?? 0), 0);
    total = Number.isFinite(sum) ? sum : 0;
    subtotal = total;
    discount = 0;
  }

  for (const it of items as Record<string, unknown>[]) {
    const qty = Number(it.qty ?? 0);
    const unit = Number(it.unitPrice ?? 0);
    const tot = Number(it.total ?? 0);

    drawRow(ctxPdf, {
      name: safeStr(it.name) || "Item",
      code: safeStr(it.code) || undefined,
      qty: Number.isFinite(qty) ? qty : 0,
      unit: Number.isFinite(unit) ? unit : 0,
      total: Number.isFinite(tot) ? tot : 0,
    });

    const f = (it.fiscal ?? null) as Record<string, unknown> | null;
    if (f) {
      ensureSpace(ctxPdf, 16);
      const fiscalLine = [
        f.origin != null ? `Origem: ${f.origin}` : null,
        f.ncm ? `NCM: ${f.ncm}` : null,
        f.cfop ? `CFOP: ${f.cfop}` : null,
        f.cst ? `CST: ${f.cst}` : null,
        f.csosn ? `CSOSN: ${f.csosn}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      if (fiscalLine) {
        ctxPdf.page.drawText(fiscalLine.slice(0, 120), { x: ctxPdf.left + 12, y: ctxPdf.y + 2, size: 9, font: ctxPdf.font });
        ctxPdf.y -= 12;
      }
    }
  }

  drawTotals(ctxPdf, subtotal, discount, total);

  // Rodapé
  ensureSpace(ctxPdf, 40);
  drawLine(ctxPdf);
  drawText(ctxPdf, "Prévia gerada pelo ERP Serralheria. Quando o emissor fiscal estiver integrado, este documento será substituído pelo DANFE oficial.", 9);
  drawText(ctxPdf, `Gerado em: ${new Date().toLocaleString("pt-BR")}`, 9);

  const bytes = await ctxPdf.pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fiscal_${inv.id}_preview.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
