import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getFiscalProvider } from "@/lib/fiscal-provider";

function requireRole(role: string | undefined, allowed: string[]) {
  return role && allowed.includes(role);
}

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!requireRole((session.user as { role?: string }).role, ["ADMIN", "CAIXA"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const id = String(ctx.params.id);

  const inv = await prisma.fiscalInvoice.findFirst({
    where: { id, companyId } as any,
    select: { id: true, status: true, payload: true } as any,
  } as any);
  if (!inv?.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const provider = await getFiscalProvider(companyId);
  let result;
  try {
    result = await provider.consult({ companyId, invoiceId: id });
  } catch (e: any) {
    const msg = e?.message ?? "consult_failed";
    if (String(msg).startsWith("fiscal_provider_not_configured:")) {
      return NextResponse.json({ error: "provider_not_configured", message: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "consult_failed", message: msg }, { status: 400 });
  }

  const updated = await prisma.fiscalInvoice.update({
    where: { id } as any,
    data: {
      status: String(result?.status ?? inv.status) as any,
      payload: {
        ...(typeof inv.payload === "object" && inv.payload !== null ? inv.payload : {}),
        providerConsult: {
          at: new Date().toISOString(),
          result: result?.raw ?? result ?? null,
        },
      },
    } as any,
    select: {
      id: true,
      status: true,
      externalId: true,
      key: true,
      issuedAt: true,
    } as any,
  } as any);

  return NextResponse.json({ ok: true, invoice: updated, consulted: true });
}
