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
    select: { id: true, xmlUrl: true, payload: true },
  });

  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!inv.xmlUrl) return NextResponse.json({ error: "xml_not_available_yet" }, { status: 404 });

  return NextResponse.json({ ok: true, xmlUrl: inv.xmlUrl });
}
