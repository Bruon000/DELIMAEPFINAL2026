import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const id = ctx.params.id;

  const inv = await prisma.fiscalInvoice.findFirst({
    where: { id, companyId },
    select: { id: true, pdfUrl: true, payload: true },
  });

  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!inv.pdfUrl) return NextResponse.json({ error: "pdf_not_available_yet" }, { status: 404 });

  return NextResponse.json({ ok: true, pdfUrl: inv.pdfUrl });
}
