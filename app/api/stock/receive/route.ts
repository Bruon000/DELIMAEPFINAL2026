import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // @ts-expect-error
  const userId = session.user.id as string;

  const body = await req.json().catch(() => null);
  const materialId = String(body?.materialId ?? "").trim();
  const qty = n(body?.quantity);

  const reference = String(body?.reference ?? "").trim();
  const note = String(body?.note ?? "").trim();

  if (!materialId || qty <= 0) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const stock = await tx.stockItem.upsert({
      where: { materialId } as any,
      update: {},
      create: { materialId, quantity: 0, reserved: 0 } as any,
      select: { materialId: true, quantity: true, reserved: true },
    } as any);

    const newQty = n(stock.quantity) + qty;

    const updated = await tx.stockItem.update({
      where: { materialId } as any,
      data: { quantity: newQty } as any,
      select: { materialId: true, quantity: true, reserved: true, updatedAt: true },
    } as any);

    const ledger = await tx.stockLedger.create({
      data: {
        materialId,
        type: "RECEIVED" as any,
        quantity: qty,
        balance: newQty,
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
