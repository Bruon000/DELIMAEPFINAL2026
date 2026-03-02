import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id as string;
  const companyId = session.user.companyId as string;

  const id = ctx.params.id;

  const po = await prisma.purchaseOrder.findFirst({
    where: { id, companyId, deletedAt: null },
    include: { items: true },
  } as any);

  if (!po) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const poItems = (po as any).items ?? [];
  if (!poItems.length) return NextResponse.json({ error: "po_no_items" }, { status: 400 });

  const st = String(po.status);
  if (st !== "SENT") return NextResponse.json({ error: "invalid_status", status: po.status }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    for (const it of poItems) {
      const materialId = String(it.materialId);
      const qty = n(it.quantity);
const unitCost = n(it.unitCost);if (unitCost > 0) {
  await tx.material.update({
    where: { id: materialId } as any,
    data: { currentCost: unitCost } as any,
  } as any);
}

const stock = await tx.stockItem.upsert({
        where: { materialId } as any,
        update: {},
        create: { materialId, quantity: 0, reserved: 0 } as any,
        select: { materialId: true, quantity: true, reserved: true },
      } as any);

      const newQty = n(stock.quantity) + qty;

      await tx.stockItem.update({
        where: { materialId } as any,
        data: { quantity: newQty, updatedAt: new Date() } as any,
      } as any);

      await tx.stockLedger.create({
        data: {
          materialId,
          type: "RECEIVED" as any,
          quantity: qty,
          balance: newQty,
          reference: `PO:${po.id}`,
          note: "Recebimento de compra (PO)",
          createdBy: userId,
        } as any,
      } as any);
    }

    const updated = await tx.purchaseOrder.update({
      where: { id } as any,
      data: { status: "RECEIVED" as any, receivedAt: new Date() } as any,
    } as any);

    return { purchaseOrderId: updated.id, status: updated.status, receivedAt: updated.receivedAt };
  });

  return NextResponse.json({ ok: true, ...result });
}


