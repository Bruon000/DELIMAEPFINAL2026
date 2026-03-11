import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function n(x: any) { return Number(x ?? 0); }

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = session?.user?.companyId;const userId = session?.user?.id;const id = ctx.params.id;
  if (!companyId || !userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ar = await prisma.accountsReceivable.findFirst({
    where: { id, companyId },
    include: { order: true },
  } as any);

  if (!ar) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (String(ar.status) === "PAID") return NextResponse.json({ error: "already_paid" }, { status: 400 });

  const amount = n(ar.amount);

  // payload { paidAt?: string (YYYY-MM-DD ou ISO), note?, paymentMethod? }
  const body = await req.json().catch(() => null);
  const paidAtRaw = body?.paidAt ? String(body.paidAt).trim() : null;
  // Interpretar YYYY-MM-DD como data local (evita mostrar dia anterior por causa de UTC)
  let paidAt: Date;
  if (paidAtRaw && /^\d{4}-\d{2}-\d{2}$/.test(paidAtRaw)) {
    const [y, m, d] = paidAtRaw.split("-").map(Number);
    paidAt = new Date(y, m - 1, d, 12, 0, 0);
  } else if (paidAtRaw) {
    paidAt = new Date(paidAtRaw);
    if (Number.isNaN(paidAt.getTime())) paidAt = new Date();
  } else {
    paidAt = new Date();
  }
  const paymentMethod = String(body?.paymentMethod ?? "").trim();
  const noteRaw = String(body?.note ?? "").trim();
  const note = paymentMethod ? (noteRaw ? `${paymentMethod} - ${noteRaw}` : paymentMethod) : noteRaw;

  // Exige caixa aberto: não criar sessão automaticamente
  const sessionOpen = await prisma.cashSession.findFirst({
    where: { companyId, userId, closedAt: null } as any,
    orderBy: { openedAt: "desc" } as any,
    select: { id: true } as any,
  } as any);

  if (!sessionOpen?.id) {
    return NextResponse.json(
      { error: "cash_not_open", message: "Abra o caixa antes de receber (Financeiro → Abrir/Fechar Caixa)." },
      { status: 400 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1) Marcar AR como paga
    const updatedAr = await tx.accountsReceivable.update({
      where: { id } as any,
      data: { status: "PAID" as any, paidAt, paidAmount: amount as any } as any,
    } as any);

    // 2) Registrar transação IN na sessão já aberta
    const description =
      note ||
      `Recebimento AR ${updatedAr.id} (Pedido ${ar.orderId})`;

    const cashTx = await tx.cashTransaction.create({
      data: {
        sessionId: sessionOpen!.id,
        type: "IN",
        amount,
        description,
        reference: `AR:${updatedAr.id}|order:${ar.orderId}`,
      },
    });

    return { cashSessionId: sessionOpen.id, cashTransactionId: cashTx.id, accountsReceivableId: updatedAr.id };
  });

  return NextResponse.json({ ok: true, ...result });
}



