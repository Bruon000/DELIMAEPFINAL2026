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
  const newQuantity = n(body?.newQuantity);

  const reference = String(body?.reference ?? "").trim() || "INVENTORY";
  const note = String(body?.note ?? "").trim() || "Ajuste de inventário";

  if (!materialId || newQuantity < 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", message: "materialId e newQuantity (>=0) são obrigatórios" },
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

    const reserved = n(stock.reserved);
    if (newQuantity < reserved) {
      return { ok: false as const, error: "below_reserved", message: `Novo saldo (${newQuantity}) não pode ser < reservado (${reserved})`, reserved };
    }

    await tx.stockItem.update({
      where: { materialId } as any,
      data: { quantity: newQuantity, updatedAt: new Date() } as any,
    } as any);

    const ledger = await tx.stockLedger.create({
      data: {
        materialId,
        type: "ADJUSTMENT" as any,
        quantity: newQuantity,
        balance: newQuantity,
        reference,
        note,
        createdBy: userId,
      } as any,
      select: { id: true, createdAt: true },
    } as any);

    return { ok: true as const, ledgerId: ledger.id, createdAt: ledger.createdAt, materialId, newQuantity };
  });

  if (!result.ok) {
    // conflito de negócio (tentou ajustar abaixo do reservado) -> 409
    const status = result.error === "below_reserved" ? 409 : 400;
    return NextResponse.json({ ok: false, error: result.error, message: result.message }, { status });
  }

  await writeAuditLog({
    companyId,
    userId,
    action: "STOCK_INVENTORY_ADJUST",
    entity: "STOCK",
    entityId: materialId,
    payload: { newQuantity, reference, note },
    ip: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  // result já contém ok:true
  return NextResponse.json(result, { status: 201 });
}
