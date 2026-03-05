import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function requireRole(role: string | undefined, allowed: string[]) {
  return role && allowed.includes(role);
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!requireRole((session.user as { role?: string }).role, ["ADMIN", "CAIXA"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const url = new URL(req.url);

  const docType = String(url.searchParams.get("docType") ?? "").trim(); // NFE/NFCE/CTE/MDFE
  const status = String(url.searchParams.get("status") ?? "").trim();
  const take = Math.min(Number(url.searchParams.get("take") ?? 30), 200);
  const cursor = String(url.searchParams.get("cursor") ?? "").trim();

  const where: { companyId: string; docType?: string; status?: string } = { companyId };
  if (docType) where.docType = docType;
  if (status) where.status = status;

  const rows = await prisma.fiscalInvoice.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      docType: true,
      model: true,
      status: true,
      orderId: true,
      number: true,
      serie: true,
      key: true,
      issuedAt: true,
      createdAt: true,
      externalId: true,
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return NextResponse.json({ rows: page, nextCursor });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Quem pode criar: ADMIN ou CAIXA (padrão)
  if (!requireRole((session.user as { role?: string }).role, ["ADMIN", "CAIXA"])) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId as string;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const orderId = String(body?.orderId ?? "").trim();
  const requestedDocType = String(body?.docType ?? "").trim(); // NFE/NFCE/CTE/MDFE (opcional)
  if (!orderId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId, deletedAt: null },
    include: {
      client: true,
      items: {
        include: {
          product: {
            include: {
              fiscal: { include: { ncm: true, cfop: true, cst: true, csosn: true } },
            },
          },
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });

  const config = await prisma.fiscalConfig.findUnique({ where: { companyId } });

  const client = order.client
    ? {
        id: order.client.id,
        name: order.client.name,
        tradeName: (order.client as { tradeName?: string | null }).tradeName ?? null,
        document: (order.client as { document?: string | null }).document ?? null,
        ie: (order.client as { ie?: string | null }).ie ?? null,
        im: (order.client as { im?: string | null }).im ?? null,
        email: order.client.email ?? null,
        phone: order.client.phone ?? null,
        address: {
          street: (order.client as { addressStreet?: string | null }).addressStreet ?? null,
          number: (order.client as { addressNumber?: string | null }).addressNumber ?? null,
          district: (order.client as { addressDistrict?: string | null }).addressDistrict ?? null,
          city: (order.client as { addressCity?: string | null }).addressCity ?? (order.client as { city?: string | null }).city ?? null,
          state: (order.client as { addressState?: string | null }).addressState ?? (order.client as { state?: string | null }).state ?? null,
          zip: (order.client as { addressZip?: string | null }).addressZip ?? (order.client as { zipCode?: string | null }).zipCode ?? null,
          raw: (order.client as { address?: string | null }).address ?? null,
        },
      }
    : null;

  function onlyDigits(v: string) {
    return v.replace(/\D/g, "");
  }
  const docDigits = onlyDigits((client?.document ?? "").toString());
  const isCnpj = docDigits.length === 14;
  const suggestedDocType = isCnpj ? "NFE" : "NFCE";

  const allowedDocTypes = ["NFE", "NFCE", "CTE", "MDFE", "NFSE"];
  const docType = (requestedDocType || suggestedDocType).toUpperCase();
  if (!allowedDocTypes.includes(docType)) {
    return NextResponse.json({ error: "invalid_docType", allowed: allowedDocTypes }, { status: 400 });
  }

  // Payload padronizado para qualquer emissor (você vai mapear depois)
  const payload = {
    docType,
    order: {
      id: order.id,
      number: order.number,
      total: order.total,
      subtotal: order.subtotal,
      discount: order.discount,
      confirmedAt: order.confirmedAt,
    },
    client,
    items: order.items.map((it) => {
      const f = it.product?.fiscal ?? null;
      return {
        productId: it.productId,
        name: it.product?.name,
        code: it.product?.code ?? null,
        qty: it.quantity,
        unitPrice: it.unitPrice,
        total: it.total,
        fiscal: f
          ? {
              origin: f.origin,
              ncm: f.ncm?.code ?? null,
              cfop: f.cfop?.code ?? null,
              cst: f.cst?.code ?? null,
              csosn: f.csosn?.code ?? null,
            }
          : null,
      };
    }),
    companyConfig: {
      environment: config?.environment ?? "HOMOLOG",
      showPaymentOnPrint: config?.showPaymentOnPrint ?? true,
      useTradeNameOnInvoice: config?.useTradeNameOnInvoice ?? true,
      useTradeNameOnRecipient: config?.useTradeNameOnRecipient ?? true,
      contingencyEnabled: config?.contingencyEnabled ?? false,
      icmsDesoneracaoEnabled: config?.icmsDesoneracaoEnabled ?? false,
    },
    // reservado para plugar emissor (mapeamento por provider)
    providerHints: {
      // se quiser, no futuro: provider: "nuvemfiscal"
      defaultCfopId: config?.defaultCfopId ?? null,
    },
    decision: {
      requestedDocType: requestedDocType || null,
      suggestedDocType,
      reason: isCnpj ? "client_document_cnpj" : "client_document_cpf_or_empty",
    },
    createdAt: new Date().toISOString(),
  };

  // model 55/65 quando aplicável
  const model = docType === "NFCE" ? 65 : docType === "NFE" ? 55 : null;

  const invoice = await prisma.fiscalInvoice.create({
    data: {
      companyId,
      orderId,
      docType,
      model,
      status: "DRAFT",
      payload,
    },
    select: { id: true, status: true, docType: true, model: true, orderId: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, invoice });
}
