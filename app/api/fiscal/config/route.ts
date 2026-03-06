import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const cfg = await prisma.fiscalConfig.findUnique({ where: { companyId } });
  const c = cfg as typeof cfg & { provider?: string | null; providerToken?: string | null } | null;

  return NextResponse.json({
    config: c
      ? {
          environment: c.environment ?? "HOMOLOG",
          provider: c.provider ?? "MOCK",
          providerToken: c.providerToken ?? "",
        }
      : { environment: "HOMOLOG", provider: "MOCK", providerToken: "" },
  });
}

export async function PATCH(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const body = (await req.json().catch(() => null)) as { provider?: string; providerToken?: string } | null;

  const provider = body?.provider ? String(body.provider).trim().toUpperCase() : "MOCK";
  const providerToken = body?.providerToken ? String(body.providerToken).trim() : "";

  const allowed = ["MOCK", "NUVEMFISCAL", "TECNOSPEED", "FOCUSNFE"];
  if (!allowed.includes(provider)) {
    return NextResponse.json({ error: "invalid_provider", allowed }, { status: 400 });
  }

  // provider/providerToken existem no schema; cast até prisma generate ser rodado após a migration
  const updated = await prisma.fiscalConfig.upsert({
    where: { companyId },
    update: { provider, providerToken } as never,
    create: { companyId, provider, providerToken } as never,
  });
  const u = updated as typeof updated & { provider?: string | null; providerToken?: string | null };

  return NextResponse.json({
    ok: true,
    config: {
      environment: u.environment ?? "HOMOLOG",
      provider: u.provider ?? "MOCK",
      providerToken: u.providerToken ?? "",
    },
  });
}
