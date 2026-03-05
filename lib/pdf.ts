import { PDFDocument, PDFPage, StandardFonts, PDFFont } from "pdf-lib";

export const A4 = { w: 595.28, h: 841.89 };

export function brl(v: any) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type PdfCtx = {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  left: number;
  right: number;
  top: number;
  bottom: number;
  y: number;
};

export async function createPdfA4() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([A4.w, A4.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ctx: PdfCtx = {
    pdf,
    page,
    font,
    bold,
    left: 48,
    right: A4.w - 48,
    top: A4.h - 42,
    bottom: 60,
    y: A4.h - 42,
  };
  return ctx;
}

export function ensureSpace(ctx: PdfCtx, needY: number, onNewPage?: (ctx: PdfCtx) => void) {
  if (ctx.y - needY >= ctx.bottom) return;
  ctx.page = ctx.pdf.addPage([A4.w, A4.h]);
  ctx.y = ctx.top;
  if (onNewPage) onNewPage(ctx);
}

export function drawText(ctx: PdfCtx, txt: string, size = 11, isBold = false, x?: number) {
  const xx = x ?? ctx.left;
  ctx.page.drawText(txt, { x: xx, y: ctx.y, size, font: isBold ? ctx.bold : ctx.font });
  ctx.y -= size + 6;
}

export function drawLine(ctx: PdfCtx) {
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: ctx.left, y: ctx.y },
    end: { x: ctx.right, y: ctx.y },
    thickness: 1,
  });
  ctx.y -= 10;
}

export type HeaderCompany = {
  name?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
};

export function drawHeader(ctx: PdfCtx, company: HeaderCompany, title: string) {
  drawText(ctx, company?.name ? String(company.name) : "Empresa", 16, true);
  drawText(
    ctx,
    `CNPJ: ${company?.document ?? "—"}  ·  Tel: ${company?.phone ?? "—"}  ·  Email: ${company?.email ?? "—"}`,
    10,
  );
  ctx.y -= 6;
  drawText(ctx, title, 14, true);
  ctx.y -= 2;
}

export type TableRow = {
  name: string;
  code?: string;
  qty: number;
  unit: number;
  total: number;
};

export function drawTableHeader(ctx: PdfCtx) {
  ensureSpace(ctx, 26);
  drawLine(ctx);
  ctx.page.drawText("Produto", { x: ctx.left, y: ctx.y, size: 10, font: ctx.bold });
  ctx.page.drawText("Qtd", { x: ctx.left + 332, y: ctx.y, size: 10, font: ctx.bold });
  ctx.page.drawText("Unit", { x: ctx.left + 382, y: ctx.y, size: 10, font: ctx.bold });
  ctx.page.drawText("Total", { x: ctx.left + 452, y: ctx.y, size: 10, font: ctx.bold });
  ctx.y -= 14;
}

export function drawRow(ctx: PdfCtx, r: TableRow) {
  ensureSpace(ctx, 18);
  const title = `${r.code ? r.code + " - " : ""}${r.name}`;
  ctx.page.drawText(title.slice(0, 62), { x: ctx.left, y: ctx.y, size: 10, font: ctx.font });
  ctx.page.drawText(String(r.qty).replace(".", ","), { x: ctx.left + 332, y: ctx.y, size: 10, font: ctx.font });
  ctx.page.drawText(brl(r.unit), { x: ctx.left + 382, y: ctx.y, size: 10, font: ctx.font });
  ctx.page.drawText(brl(r.total), { x: ctx.left + 452, y: ctx.y, size: 10, font: ctx.font });
  ctx.y -= 14;
}

export function drawTotals(ctx: PdfCtx, subtotal: number, discount: number, total: number) {
  ensureSpace(ctx, 70);
  ctx.y -= 6;
  drawLine(ctx);
  drawText(ctx, `Subtotal: ${brl(subtotal)}`, 11, true);
  if (discount > 0) drawText(ctx, `Desconto: - ${brl(discount)}`, 11, true);
  drawText(ctx, `Total: ${brl(total)}`, 13, true);
}
