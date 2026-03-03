import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { XMLParser } from "fast-xml-parser";

function onlyDigits(v: any) { return String(v ?? "").replace(/\D/g, ""); }
function n(x: any) { return Number(x ?? 0); }

function asArray<T>(x: any): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

export async function POST(req: Request) {
  try {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;

  const body = await req.json().catch(() => null);
  const xml = String(body?.xml ?? "");
  if (!xml || xml.length < 50) return NextResponse.json({ error: "xml_required" }, { status: 400 });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    removeNSPrefix: true,
    parseTagValue: true,
    parseAttributeValue: true,
    trimValues: true,
  });

  let doc: any;
  try {
    doc = parser.parse(xml);
  } catch (e: any) {
    return NextResponse.json({ error: "xml_parse_error", message: String(e?.message ?? e) }, { status: 400 });
  }

  const infNFe = doc?.nfeProc?.NFe?.infNFe ?? doc?.NFe?.infNFe ?? doc?.nfeProc?.NFe?.NFe?.infNFe;
  if (!infNFe) return NextResponse.json({ error: "invalid_nfe_xml" }, { status: 400 });

  const emit = infNFe?.emit ?? {};
  const emitCnpj = onlyDigits(emit?.CNPJ ?? emit?.CPF);
  const emitName = String(emit?.xNome ?? "Fornecedor").trim();

  const infId = String(infNFe?.Id ?? "");
  const chNFe = onlyDigits(infId).slice(-44) || null;

  const dets = asArray<any>(infNFe?.det);
  const items = dets.map((d: any) => {
    const prod = d?.prod ?? {};
    const name = String(prod?.xProd ?? "").trim();
    const qty = n(prod?.qCom);
    const unit = String(prod?.uCom ?? "").trim() || null;
    const unitCost = n(prod?.vUnCom);
    const total = n(prod?.vProd);
    return { name, qty, unit, unitCost, total };
  }).filter((x: any) => x.name && x.qty > 0 && x.unitCost >= 0);

  if (items.length === 0) return NextResponse.json({ error: "nfe_no_items" }, { status: 400 });

  // DEDUPE por chave da NF-e (chNFe) usando FiscalInvoice + notas da PurchaseOrder
  if (chNFe) {
    const existingFiscal = await prisma.fiscalInvoice.findFirst({
      where: {
        companyId,
        key: chNFe,
        type: "NF-E",
      } as any,
    } as any);

    if (existingFiscal) {
      let purchaseOrderId: string | null = null;
      let itemsCount: number | null = null;

      const payload: any = existingFiscal.payload ?? null;
      if (payload) {
        if (payload.purchaseOrderId) purchaseOrderId = String(payload.purchaseOrderId);
        if (typeof payload.itemsCount === "number") itemsCount = payload.itemsCount;
      }

      if (!purchaseOrderId) {
        const existingPo = await prisma.purchaseOrder.findFirst({
          where: {
            companyId,
            deletedAt: null,
            notes: `NF-e ${chNFe}`,
          } as any,
          include: { items: true },
        } as any);

        if (existingPo) {
          purchaseOrderId = existingPo.id;
          itemsCount = itemsCount ?? (existingPo as any).items.length;
        }
      }

      return NextResponse.json(
        {
          ok: true,
          alreadyImported: true,
          purchaseOrderId,
          chNFe,
          itemsCount: itemsCount ?? items.length,
        },
        { status: 200 },
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1) upsert fornecedor por documento (CNPJ)
    let supplierId: string | null = null;

    if (emitCnpj) {
      const existing = await tx.supplier.findFirst({
        where: { companyId, deletedAt: null, document: emitCnpj } as any,
        select: { id: true },
      } as any);

      if (existing?.id) {
        supplierId = existing.id;
      } else {
        const created = await tx.supplier.create({
          data: { company: { connect: { id: companyId } }, name: emitName, document: emitCnpj } as any,
          select: { id: true },
        } as any);
        supplierId = created.id;
      }
    } else {
      const created = await tx.supplier.create({
        data: { company: { connect: { id: companyId } }, name: emitName, document: null } as any,
        select: { id: true },
      } as any);
      supplierId = created.id;
    }

    // 2) criar PO em DRAFT
    const po = await tx.purchaseOrder.create({
      data: {
        company: { connect: { id: companyId } },
        supplier: { connect: { id: supplierId } },
        status: "DRAFT" as any,
        notes: chNFe ? `NF-e ${chNFe}` : "NF-e importada (sem chave detectada)",
      } as any,
      select: { id: true },
    } as any);

    // 3) resolver unidade (UnitOfMeasure)
    const fallbackUnit = await tx.unitOfMeasure.findFirst({
      where: { companyId } as any,
      select: { id: true, code: true, name: true },
      orderBy: { createdAt: "asc" } as any,
    } as any);

    const unitCache = new Map<string, string>();

    async function resolveUnitId(unitCode: string | null): Promise<string> {
      const key = String(unitCode ?? "").trim().toUpperCase() || "";
      if (key && unitCache.has(key)) return unitCache.get(key)!;

      if (key) {
        const found = await tx.unitOfMeasure.findFirst({
          where: {
            companyId,
            OR: [
              { code: { equals: key, mode: "insensitive" } as any },
              { name: { equals: key, mode: "insensitive" } as any },
            ],
          } as any,
          select: { id: true },
        } as any);

        if (found?.id) {
          unitCache.set(key, found.id);
          return found.id;
        }
      }

      if (fallbackUnit?.id) return fallbackUnit.id;

      // Se não existir nenhuma unidade cadastrada, estoura com erro claro
      throw new Error("unit_required: cadastre ao menos 1 unidade em /cadastros/unidades (ex: UN)");
    }
    // 3) mapear itens -> Materials (MVP por nome)
    for (const it of items) {
      const mat = await tx.material.findFirst({
        where: {
          companyId,
          deletedAt: null,
          name: { equals: it.name, mode: "insensitive" } as any,
        } as any,
        select: { id: true },
      } as any);

      let materialId = mat?.id ?? null;

      if (!materialId) {
        const createdMat = await tx.material.create({
          data: {
            company: { connect: { id: companyId } },
            unit: { connect: { id: await resolveUnitId(it.unit) } },
            name: it.name,
            currentCost: it.unitCost > 0 ? it.unitCost : 0,
          } as any,
          select: { id: true },
        } as any);
        materialId = createdMat.id;
      }

      const total = n(it.qty) * n(it.unitCost);

      await tx.purchaseOrderItem.create({
        data: {
          poId: po.id,
          materialId,
          quantity: n(it.qty),
          unitCost: n(it.unitCost),
          total,
        } as any,
      } as any);
    }

    // 4) enviar PO
    await tx.purchaseOrder.update({
      where: { id: po.id } as any,
      data: { status: "SENT" as any } as any,
    } as any);

    // 5) receber (replica a lógica atual do receive)
    const poFull = await tx.purchaseOrder.findFirst({
      where: { id: po.id, companyId, deletedAt: null } as any,
      include: { items: true },
    } as any);

    const poItems = (poFull as any)?.items ?? [];

    for (const pit of poItems) {
      const materialId = String(pit.materialId);
      const qty = n(pit.quantity);
      const unitCost = n(pit.unitCost);

      if (unitCost > 0) {
        await tx.material.update({
          where: { id: materialId } as any,
          data: { currentCost: unitCost } as any,
        } as any);
      }

      const stock = await tx.stockItem.upsert({
        where: { materialId } as any,
        update: {} as any,
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
          reference: chNFe ? `NFE:${chNFe}` : `PO:${po.id}`,
          note: "Recebimento por importação de NF-e (XML)",
          createdBy: userId,
        } as any,
      } as any);
    }

    await tx.purchaseOrder.update({
      where: { id: po.id } as any,
      data: { status: "RECEIVED" as any, receivedAt: new Date() } as any,
    } as any);

    // Registrar FiscalInvoice para dedupe futuro
    if (chNFe) {
      await tx.fiscalInvoice.create({
        data: {
          companyId,
          key: chNFe,
          type: "NF-E",
          status: "RECEIVED",
          payload: {
            purchaseOrderId: po.id,
            supplierId,
            itemsCount: items.length,
          },
        } as any,
      } as any);
    }

    return { purchaseOrderId: po.id, chNFe, supplierId, itemsCount: items.length };
  });

  await writeAuditLog({
    companyId,
    userId,
    action: "NFE_IMPORTED",
    entity: "PURCHASE_ORDER",
    entityId: result.purchaseOrderId,
    payload: { chNFe: result.chNFe, itemsCount: result.itemsCount },
    ip: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e: any) {
    console.error("NFE_IMPORT_ERROR", e);
    const msg = String(e?.message ?? e);
    if (msg.startsWith("unit_required")) {
      return NextResponse.json({ error: "unit_required", message: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "internal_error", message: msg }, { status: 500 });
  }
}
