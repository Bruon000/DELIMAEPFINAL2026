import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const cfg = await prisma.fiscalConfig.findUnique({ where: { companyId } });
  return NextResponse.json({
    config: {
      environment: cfg?.environment ?? "HOMOLOG",
      provider: cfg?.provider ?? "MOCK",
      providerToken: cfg?.providerToken ?? "",
      providerBaseUrl: (cfg as any)?.providerBaseUrl ?? "",
      webhookSecret: (cfg as any)?.webhookSecret ?? "",
    },
  });
}

export async function PATCH(req: Request) {
  const gate = await requireRole(["ADMIN"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;
  const body = (await req.json().catch(() => null)) as {
    provider?: string;
    providerToken?: string;
    providerBaseUrl?: string;
    webhookSecret?: string;
  } | null;

  const provider = body?.provider ? String(body.provider).trim().toUpperCase() : "MOCK";
  const providerToken = body?.providerToken ? String(body.providerToken).trim() : "";
  const providerBaseUrl = body?.providerBaseUrl ? String(body.providerBaseUrl).trim() : "";
  const webhookSecret = body?.webhookSecret ? String(body.webhookSecret).trim() : "";

  const allowed = ["MOCK", "NUVEMFISCAL", "TECNOSPEED", "FOCUSNFE"];
  if (!allowed.includes(provider)) {
    return NextResponse.json({ error: "invalid_provider", allowed }, { status: 400 });
  }

  const updated = await prisma.fiscalConfig.upsert({
    where: { companyId },
    update: {
      provider,
      providerToken,
      providerBaseUrl,
      webhookSecret,
    } as any,
    create: {
      companyId,
      provider,
      providerToken,
      providerBaseUrl,
      webhookSecret,
    } as any,
  });

  return NextResponse.json({
    ok: true,
    config: {
      environment: updated.environment ?? "HOMOLOG",
      provider: updated.provider ?? "MOCK",
      providerToken: updated.providerToken ?? "",
      providerBaseUrl: (updated as any)?.providerBaseUrl ?? "",
      webhookSecret: (updated as any)?.webhookSecret ?? "",
    },
  });
}
