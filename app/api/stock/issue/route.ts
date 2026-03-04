import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "Sessão expirada. Faça login novamente." },
      { status: 401 },
    );
  }

  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;

  const body = await req.json().catch(() => null);
  const materialId = String(body?.materialId ?? "").trim();
  const qty = n(body?.quantity);

  const reference = String(body?.reference ?? "").trim() || null;
  const note = String(body?.note ?? "").trim() || null;
  const reason = String(body?.reason ?? "").trim() || null;

  if (!materialId || qty <= 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", message: "materialId e quantity (>0) são obrigatórios" },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.stockItem.upsert({
      where: { materialId } as any,
      update: {} as any,
      create: { materialId, quantity: 0, reserved: 0 } as any,
      select: { materialId: true, quantity: true, reserved: true },
    } as any);

    const currentQty = n(stock?.quantity);
    const reserved = n(stock?.reserved);
    const available = currentQty - reserved;
    if (qty > available) {
      return { ok: false as const, error: "insufficient_stock", message: `Disponível ${available}, solicitado ${qty}`, currentQty, reserved };
    }

    const newQty = currentQty - qty;

    await tx.stockItem.update({
      where: { materialId } as any,
      data: { quantity: newQty, updatedAt: new Date() } as any,
    } as any);

    const ledger = await tx.stockLedger.create({
      data: {
        materialId,
        type: "ISSUED" as any,
        quantity: qty,
        balance: newQty,
        reference,
        note: note || (reason ? `Saída: ${reason}` : "Saída manual"),
        createdBy: userId,
      } as any,
      select: { id: true, createdAt: true },
    } as any);

    return { ok: true as const, ledgerId: ledger.id, createdAt: ledger.createdAt, materialId, qty, balance: newQty };
  });

  if (!result.ok) {
    // conflito de negócio (estoque insuficiente) -> 409
    const status = result.error === "insufficient_stock" ? 409 : 400;
    return NextResponse.json({ ok: false, error: result.error, message: result.message }, { status });
  }

  await writeAuditLog({
    companyId,
    userId,
    action: "STOCK_ISSUED",
    entity: "STOCK",
    entityId: materialId,
    payload: { quantity: qty, reference, reason, note },
    ip: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  // result já contém ok:true
  return NextResponse.json(result, { status: 201 });
}
