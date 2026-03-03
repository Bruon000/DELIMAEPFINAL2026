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
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized", message: "Não autorizado" }, { status: 401 });
  }

  const companyId = session.user.companyId as string;
  const userId = session.user.id as string;

  const body = await req.json().catch(() => null);
  const xml = String(body?.xml ?? "");
  if (!xml || xml.length < 50) {
    return NextResponse.json({ ok: false, error: "xml_required", message: "XML inválido ou muito curto" }, { status: 400 });
  }

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
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: "xml_parse_error", message: String((e as Error)?.message ?? e) }, { status: 400 });
  }

  const infNFe = doc?.nfeProc?.NFe?.infNFe ?? doc?.NFe?.infNFe ?? doc?.nfeProc?.NFe?.NFe?.infNFe;
  if (!infNFe) {
    return NextResponse.json({ ok: false, error: "invalid_nfe_xml", message: "XML não é uma NF-e válida" }, { status: 400 });
  }

  const emit = infNFe?.emit ?? {};
  const emitCnpj = onlyDigits(emit?.CNPJ ?? emit?.CPF);
  const emitName = String(emit?.xNome ?? "Fornecedor").trim();

  const infId = String(infNFe?.Id ?? "");
  let chNFe: string | null = onlyDigits(infId).slice(-44) || null;
  if (!chNFe || chNFe.length !== 44) {
    const chProt = onlyDigits(
      doc?.nfeProc?.protNFe?.infProt?.chNFe ?? doc?.protNFe?.infProt?.chNFe ?? ""
    );
    if (chProt.length >= 44) chNFe = chProt.slice(-44);
  }

  const dets = asArray<any>(infNFe?.det);
  const items = dets.map((d: any) => {
    const prod = d?.prod ?? {};
    const name = String(prod?.xProd ?? "").trim();
    const cProd = String(prod?.cProd ?? "").trim() || null;
    const qty = n(prod?.qCom);
    const unit = String(prod?.uCom ?? "").trim() || null;
    const unitCost = n(prod?.vUnCom);
    const total = n(prod?.vProd);
    return { name, cProd, qty, unit, unitCost, total };
  }).filter((x: any) => x.name && x.qty > 0 && x.unitCost >= 0);

  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "nfe_no_items", message: "NF-e sem itens válidos" }, { status: 400 });
  }

  const dhEmiRaw = infNFe?.ide?.dhEmi ? String(infNFe.ide.dhEmi) : undefined;
  const issuedAt = dhEmiRaw && !Number.isNaN(Date.parse(dhEmiRaw)) ? new Date(dhEmiRaw) : undefined;
  const supplierName = emitName;

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

      await writeAuditLog({
        companyId,
        userId,
        action: "NFE_IMPORT_DEDUPE",
        entity: "PURCHASE_ORDER",
        entityId: purchaseOrderId ?? undefined,
        payload: { chNFe, purchaseOrderId, itemsCount: itemsCount ?? items.length, supplierName, emittedAt: dhEmiRaw },
        ip: req.headers.get("x-forwarded-for") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
      });

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

    // 3) resolver unidade (UnitOfMeasure): preferir code "UN" como fallback
    const allUnits = await tx.unitOfMeasure.findMany({
      where: { companyId } as any,
      select: { id: true, code: true, name: true },
      orderBy: { createdAt: "asc" } as any,
    } as any);
    const fallbackUnit = allUnits.find((u: { code: string }) => String(u?.code ?? "").toUpperCase() === "UN") ?? allUnits[0] ?? null;

    const unitCache = new Map<string, string>();

    async function resolveUnitId(unitCode: string | null): Promise<string> {
      const raw = String(unitCode ?? "").trim();
      const key = raw.toUpperCase() || "";
      if (key && unitCache.has(key)) return unitCache.get(key)!;

      if (key) {
        const byCode = await tx.unitOfMeasure.findFirst({
          where: { companyId, code: { equals: raw, mode: "insensitive" } as any } as any,
          select: { id: true },
        } as any);
        if (byCode?.id) {
          unitCache.set(key, byCode.id);
          return byCode.id;
        }
        const byName = await tx.unitOfMeasure.findFirst({
          where: { companyId, name: { equals: raw, mode: "insensitive" } as any } as any,
          select: { id: true },
        } as any);
        if (byName?.id) {
          unitCache.set(key, byName.id);
          return byName.id;
        }
      }

      if (fallbackUnit?.id) return fallbackUnit.id;

      throw new Error("unit_required: cadastre ao menos 1 unidade em /cadastros/unidades (ex: UN)");
    }
    // 4) mapear itens -> Materials: primeiro por code (cProd), depois por nome
    for (const it of items) {
      let mat: { id: string } | null = null;
      if (it.cProd) {
        mat = await tx.material.findFirst({
          where: { companyId, deletedAt: null, code: it.cProd } as any,
          select: { id: true },
        } as any);
      }
      if (!mat?.id) {
        mat = await tx.material.findFirst({
          where: { companyId, deletedAt: null, name: { equals: it.name, mode: "insensitive" } as any } as any,
          select: { id: true },
        } as any);
      }
      let materialId = mat?.id ?? null;

      if (!materialId) {
        const createdMat = await tx.material.create({
          data: {
            company: { connect: { id: companyId } },
            unit: { connect: { id: await resolveUnitId(it.unit) } },
            name: it.name,
            code: it.cProd || undefined,
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

    // Registrar FiscalInvoice para dedupe futuro (race: se P2002, tratar como alreadyImported)
    if (chNFe) {
      try {
        await tx.fiscalInvoice.create({
          data: {
            companyId,
            key: chNFe,
            type: "NF-E",
            status: "RECEIVED",
            issuedAt,
            payload: {
              purchaseOrderId: po.id,
              supplierId,
              itemsCount: items.length,
            },
          } as any,
        } as any);
      } catch (uniqueErr: unknown) {
        const code = (uniqueErr as { code?: string })?.code;
        if (code === "P2002") {
          const existing = await tx.fiscalInvoice.findFirst({
            where: { companyId, key: chNFe, type: "NF-E" } as any,
            select: { id: true, payload: true },
          } as any);
          const payload: any = existing?.payload ?? null;
          const purchaseOrderIdExisting = payload?.purchaseOrderId ?? null;
          const itemsCountExisting = typeof payload?.itemsCount === "number" ? payload.itemsCount : items.length;
          return { _dedupe: true, purchaseOrderId: purchaseOrderIdExisting, chNFe, itemsCount: itemsCountExisting };
        }
        throw uniqueErr;
      }
    }

    return { purchaseOrderId: po.id, chNFe, supplierId, itemsCount: items.length };
  });

  if ((result as { _dedupe?: boolean })._dedupe) {
    const d = result as { _dedupe: boolean; purchaseOrderId: string | null; chNFe: string | null; itemsCount: number };
    await writeAuditLog({
      companyId,
      userId,
      action: "NFE_IMPORT_DEDUPE",
      entity: "PURCHASE_ORDER",
      entityId: d.purchaseOrderId ?? undefined,
      payload: { chNFe: d.chNFe, purchaseOrderId: d.purchaseOrderId, itemsCount: d.itemsCount, supplierName, emittedAt: dhEmiRaw },
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({
      ok: true,
      alreadyImported: true,
      purchaseOrderId: d.purchaseOrderId,
      chNFe: d.chNFe,
      itemsCount: d.itemsCount,
    }, { status: 200 });
  }

  const res = result as { purchaseOrderId: string; chNFe: string | null; supplierId: string; itemsCount: number };
  await writeAuditLog({
    companyId,
    userId,
    action: "NFE_IMPORTED",
    entity: "PURCHASE_ORDER",
    entityId: res.purchaseOrderId,
    payload: { chNFe: res.chNFe, purchaseOrderId: res.purchaseOrderId, itemsCount: res.itemsCount, supplierId: res.supplierId, supplierName, emittedAt: dhEmiRaw },
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.json({ ok: true, ...res }, { status: 201 });
  } catch (e: unknown) {
    console.error("NFE_IMPORT_ERROR", e);
    const msg = String((e as Error)?.message ?? e);
    if (msg.startsWith("unit_required")) {
      return NextResponse.json({ ok: false, error: "unit_required", message: msg }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "internal_error", message: msg }, { status: 500 });
  }
}
