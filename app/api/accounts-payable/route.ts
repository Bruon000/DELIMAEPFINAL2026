import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(
    {
      ok: false,
      error: "integration_pending",
      message: "AccountsPayable ainda não foi implementado (stub).",
      items: [],
    },
    { status: 501 }
  );
}

export async function POST() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(
    { ok: false, error: "integration_pending", message: "Criar despesa: integração pendente (stub)." },
    { status: 501 }
  );
}
