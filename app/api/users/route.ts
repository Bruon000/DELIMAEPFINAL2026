import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const ALLOWED_ROLES = new Set(["ADMIN", "VENDEDOR", "CAIXA", "PRODUCAO", "INSTALADOR", "CONTADOR"]);

export async function GET() {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = (session.user as any).companyId as string;

  const users = await prisma.user.findMany({
    where: { deletedAt: null, companyId } as any,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      companyId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").toLowerCase().trim();
  const name = String(body?.name ?? "").trim();
  const role = String(body?.role ?? "VENDEDOR").trim().toUpperCase();
  const password = String(body?.password ?? "").trim();
  const companyId = String(body?.companyId ?? (session.user as any).companyId ?? "").trim();

  if (!email || !name || !password || !companyId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "role_invalid" }, { status: 400 });
  }

  const exists = await prisma.user.findFirst({ where: { email, deletedAt: null } });
  if (exists) return NextResponse.json({ error: "email_in_use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      id: `usr_${Date.now()}`,
      email,
      name,
      role: role as any,
      companyId,
      isActive: true,
      passwordHash,
    },
    select: { id: true, email: true, name: true, role: true, isActive: true, companyId: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
