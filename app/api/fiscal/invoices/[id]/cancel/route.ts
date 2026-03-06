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
  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  const reason = String(body?.reason ?? "").trim();
  if (reason.length < 5) return NextResponse.json({ error: "invalid_reason" }, { status: 400 });

  const inv = await prisma.fiscalInvoice.findFirst({ where: { id, companyId } });
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const provider = await getFiscalProvider(companyId);
  try {
    await provider.cancel({ companyId, invoiceId: id, reason });
  } catch (e: any) {
    const msg = e?.message ?? "cancel_failed";
    if (String(msg).startsWith("fiscal_provider_not_configured:")) {
      return NextResponse.json({ error: "provider_not_configured", message: msg }, { status: 409 });
    }
    return NextResponse.json({ error: "cancel_failed", message: msg }, { status: 400 });
  }

  const updated = await prisma.fiscalInvoice.update({
    where: { id },
    data: { status: "CANCELLED" },
    select: { id: true, status: true },
  });

  return NextResponse.json({ ok: true, invoice: updated });
}

