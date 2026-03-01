import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id as string;

  const body = await req.json().catch(() => null);
  const materialId = String(body?.materialId ?? "").trim();
  const newBalance = n(body?.newBalance);

  const reference = String(body?.reference ?? "").trim();
  const note = String(body?.note ?? "").trim();

  if (!materialId) return NextResponse.json({ error: "material_required" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.stockItem.upsert({
      where: { materialId } as any,
      update: {},
      create: { materialId, quantity: 0, reserved: 0 } as any,
      select: { materialId: true, quantity: true, reserved: true },
    } as any);

    const currentQty = n(stock.quantity);
    const delta = newBalance - currentQty;

    const updated = await tx.stockItem.update({
      where: { materialId } as any,
      data: { quantity: newBalance } as any,
      select: { materialId: true, quantity: true, reserved: true, updatedAt: true },
    } as any);

    const ledger = await tx.stockLedger.create({
      data: {
        materialId,
        type: "ADJUSTMENT" as any,
        quantity: delta,   // pode ser positivo ou negativo
        balance: newBalance,
        reference: reference || null,
        note: note || null,
        createdBy: userId,
      } as any,
      select: { id: true, materialId: true, type: true, quantity: true, balance: true, createdAt: true },
    } as any);

    return { stock: updated, ledger };
  });

  return NextResponse.json({ ok: true, ...result }, { status: 201 });
}
