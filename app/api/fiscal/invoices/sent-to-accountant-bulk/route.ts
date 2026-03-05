import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

function toDateOrNull(v: string | null) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const session = gate.session;
  const companyId = session.user!.companyId as string;
  const url = new URL(req.url);

  const from = toDateOrNull(url.searchParams.get("from"));
  const to = toDateOrNull(url.searchParams.get("to"));
  const docType = String(url.searchParams.get("docType") ?? "").trim();
  const status = String(url.searchParams.get("status") ?? "").trim();

  const body = (await req.json().catch(() => null)) as { note?: string } | null;
  const note = String(body?.note ?? "Enviado ao contador").trim();

  const where: {
    companyId: string;
    docType?: string;
    status?: string;
    createdAt?: { gte?: Date; lte?: Date };
    sentToAccountantAt: null;
  } = {
    companyId,
    sentToAccountantAt: null,
  };
  if (docType) where.docType = docType.toUpperCase();
  if (status) where.status = status.toUpperCase();

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const result = await prisma.fiscalInvoice.updateMany({
    where,
    data: {
      sentToAccountantAt: new Date(),
      sentToAccountantNote: note || null,
    },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
