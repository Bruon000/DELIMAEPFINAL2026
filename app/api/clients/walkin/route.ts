import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

export async function GET() {
  const gate = await requireRole(["ADMIN", "VENDEDOR", "CAIXA"]);
  if (!gate.ok) return gate.res;

  const companyId = gate.session.user!.companyId as string;

  const walkin = await prisma.client.findFirst({
    where: { companyId, document: "WALKIN", deletedAt: null } as any,
    select: { id: true, name: true } as any,
  } as any);

  if (!walkin) {
    return NextResponse.json({ error: "walkin_not_found" }, { status: 404 });
  }

  return NextResponse.json({ client: walkin });
}
