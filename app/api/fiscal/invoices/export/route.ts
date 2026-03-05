import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function requireRole(role: string | undefined, allowed: string[]) {
  return role && allowed.includes(role);
}

function toDateOrNull(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!requireRole((session.user as { role?: string }).role, ["ADMIN"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const url = new URL(req.url);

  const from = toDateOrNull(url.searchParams.get("from")); // YYYY-MM-DD
  const to = toDateOrNull(url.searchParams.get("to"));     // YYYY-MM-DD
  const docType = String(url.searchParams.get("docType") ?? "").trim();
  const status = String(url.searchParams.get("status") ?? "").trim();

  const where: { companyId: string; docType?: string; status?: string; createdAt?: { gte?: Date; lte?: Date } } = { companyId };
  if (docType) where.docType = docType.toUpperCase();
  if (status) where.status = status.toUpperCase();

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) {
      // inclui o dia inteiro
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const rows = await prisma.fiscalInvoice.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      docType: true,
      model: true,
      status: true,
      serie: true,
      number: true,
      key: true,
      issuedAt: true,
      createdAt: true,
      orderId: true,
      sentToAccountantAt: true,
    },
  });

  const header = [
    "id",
    "docType",
    "model",
    "status",
    "serie",
    "number",
    "key",
    "issuedAt",
    "createdAt",
    "orderId",
    "sentToAccountantAt",
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.docType,
        r.model ?? "",
        r.status,
        r.serie ?? "",
        r.number ?? "",
        r.key ?? "",
        r.issuedAt ? new Date(r.issuedAt).toISOString() : "",
        new Date(r.createdAt).toISOString(),
        r.orderId ?? "",
        r.sentToAccountantAt ? new Date(r.sentToAccountantAt).toISOString() : "",
      ].map(csvEscape).join(",")
    );
  }

  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fiscal_export.csv"`,
    },
  });
}
