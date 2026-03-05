import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFiscalProvider } from "@/lib/fiscal-provider";

function requireRole(role: string | undefined, allowed: string[]) {
  return role && allowed.includes(role);
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!requireRole((session.user as { role?: string }).role, ["ADMIN", "CAIXA"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const id = ctx.params.id;

  const inv = await prisma.fiscalInvoice.findFirst({ where: { id, companyId } });
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const provider = getFiscalProvider();
  const result = await provider.emit({
    companyId,
    invoiceId: id,
    docType: inv.docType as "NFE" | "NFCE" | "CTE" | "MDFE" | "NFSE",
  });

  // grava metadados retornados (sem inventar número!)
  const updated = await prisma.fiscalInvoice.update({
    where: { id },
    data: {
      externalId: result.externalId ?? inv.externalId,
      status: result.status,
      model: result.model ?? inv.model,
      serie: result.serie ?? inv.serie,
      number: result.number ?? inv.number,
      key: result.key ?? inv.key,
      pdfUrl: result.pdfUrl ?? inv.pdfUrl,
      xmlUrl: result.xmlUrl ?? inv.xmlUrl,
      payload: {
        ...(typeof inv.payload === "object" && inv.payload !== null ? inv.payload : {}),
        providerResult: result.raw ?? null,
      },
    },
    select: {
      id: true,
      status: true,
      externalId: true,
      model: true,
      serie: true,
      number: true,
      key: true,
    },
  });

  return NextResponse.json({ ok: true, invoice: updated });
}
