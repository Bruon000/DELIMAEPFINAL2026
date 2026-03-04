import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(
    { ok: false, error: "integration_pending", message: "Detalhe de despesa (stub)." },
    { status: 501 }
  );
}

export async function PATCH() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(
    { ok: false, error: "integration_pending", message: "Atualizar/Marcar pago (stub)." },
    { status: 501 }
  );
}

export async function DELETE() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(
    { ok: false, error: "integration_pending", message: "Excluir despesa (stub)." },
    { status: 501 }
  );
}
