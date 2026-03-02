const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function dec(v) {
  // Prisma Decimal aceita string/number
  return String(v);
}

async function upsertUnit(companyId, code, name) {
  const exists = await prisma.unitOfMeasure.findFirst({ where: { companyId, code } });
  if (exists) return exists;
  return prisma.unitOfMeasure.create({ data: { companyId, code, name } });
}

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error("Sem Company. Rode seed primeiro.");

  console.log("Company:", company.id, company.name);

  // ===== UNIDADES =====
  const un = await upsertUnit(company.id, "un", "Unidade");
  const m = await upsertUnit(company.id, "m", "Metro");
  const kg = await upsertUnit(company.id, "kg", "Quilo");
  const barra = await upsertUnit(company.id, "barra", "Barra");

  // ===== MATERIAIS + ESTOQUE =====
  async function upsertMaterial(name, unitId, currentCost, initialQty) {
    let mat = await prisma.material.findFirst({ where: { companyId: company.id, name, deletedAt: null } });
    if (!mat) {
      mat = await prisma.material.create({
        data: {
          companyId: company.id,
          unitId,
          name,
          currentCost: dec(currentCost),
          minStock: dec(0),
          isActive: true,
        },
      });
    }

    // garante StockItem
    let si = await prisma.stockItem.findFirst({ where: { materialId: mat.id } });
    if (!si) {
      si = await prisma.stockItem.create({
        data: { materialId: mat.id, quantity: dec(0), reserved: dec(0) },
      });
    }

    // se estoque inicial > 0 e balance estiver zerado, dar entrada via ledger
    const hasLedger = await prisma.stockLedger.findFirst({ where: { materialId: mat.id } });
    if (!hasLedger && Number(initialQty) > 0) {
      const newBal = dec(initialQty);
      await prisma.stockLedger.create({
        data: {
          materialId: mat.id,
          type: "RECEIVED",
          quantity: dec(initialQty),
          balance: newBal,
          reference: "BOOTSTRAP:INIT",
          note: "Carga inicial de estoque (demo)",
        },
      });
      await prisma.stockItem.update({
        where: { id: si.id },
        data: { quantity: newBal },
      });
    }

    return mat;
  }

  const mat1 = await upsertMaterial("Tubo 20x20", barra.id, 120, 10);
  const mat2 = await upsertMaterial("Chapa 1.2mm", kg.id, 18, 50);
  const mat3 = await upsertMaterial("Eletrodo", kg.id, 25, 5);

  // ===== PRODUTOS =====
  async function upsertProduct(name, unitId, salePrice, type = "SIMPLE") {
  let p = await prisma.product.findFirst({ where: { companyId: company.id, name, deletedAt: null } });
  if (!p) {
    p = await prisma.product.create({
      data: {
        companyId: company.id,
        unitId,
        name,
        type,
        salePrice: dec(salePrice),
        markup: dec(0),
        isActive: true,
      },
    });
  } else {
    if (p.type !== type) {
      p = await prisma.product.update({ where: { id: p.id }, data: { type } });
    }
  }
  return p;
}

  const prod1 = await upsertProduct("Portão Basico", un.id, 950, "COMPOSTO");
  const prod2 = await upsertProduct("Grade Janela", un.id, 320, "COMPOSTO");
  const prod3 = await upsertProduct("Corrimão Simples", m.id, 180, "SIMPLE");

  
  // ===== BOM (Estrutura de Materiais) =====
  async function upsertBom(productId, lossPercent = 0) {
    return prisma.bOM.upsert({
      where: { productId },
      update: { lossPercent: dec(lossPercent) },
      create: { productId, lossPercent: dec(lossPercent) },
    });
  }

  async function upsertBomItem(bomId, materialId, qty) {
    return prisma.bOMItem.upsert({
      where: { bomId_materialId: { bomId, materialId } },
      update: { quantity: dec(qty) },
      create: { bomId, materialId, quantity: dec(qty) },
    });
  }

  // Portão Basico (COMPOSITE) - exemplo
  const bom1 = await upsertBom(prod1.id, 5);
  await upsertBomItem(bom1.id, mat1.id, 2);
  await upsertBomItem(bom1.id, mat2.id, 5);
  await upsertBomItem(bom1.id, mat3.id, 0.5);

  // Grade Janela (COMPOSITE) - exemplo
  const bom2 = await upsertBom(prod2.id, 3);
  await upsertBomItem(bom2.id, mat1.id, 1);
  await upsertBomItem(bom2.id, mat2.id, 2);
  await upsertBomItem(bom2.id, mat3.id, 0.2);// ===== CLIENTE =====
  let client = await prisma.client.findFirst({ where: { companyId: company.id, name: "Cliente Demo", deletedAt: null } });
  if (!client) {
    client = await prisma.client.create({
      data: {
        companyId: company.id,
        name: "Cliente Demo",
        document: "000.000.000-00",
        phone: "(11) 99999-9999",
        email: "cliente@demo.com",
        isActive: true,
      },
    });
  }

  // ===== FORNECEDOR =====
  let supplier = await prisma.supplier.findFirst({ where: { companyId: company.id, name: "Fornecedor Demo", deletedAt: null } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        companyId: company.id,
        name: "Fornecedor Demo",
        document: "00.000.000/0001-00",
        phone: "(11) 98888-8888",
        email: "fornecedor@demo.com",
        isActive: true,
      },
    });
  }

  // ===== PEDIDO DRAFT + ITENS =====
  // cria um pedido e itens com total calculado
  const itemsToCreate = [
    { product: prod1, qty: 1, unitPrice: 950 },
    { product: prod2, qty: 2, unitPrice: 320 },
  ];

  const subtotal = itemsToCreate.reduce((acc, it) => acc + (it.qty * it.unitPrice), 0);
  const discount = 0;
  const total = subtotal - discount;

  const order = await prisma.order.create({
    data: {
      companyId: company.id,
      clientId: client.id,
      status: "DRAFT",
      subtotal: dec(subtotal),
      discount: dec(discount),
      total: dec(total),
      notes: "Pedido demo criado pelo bootstrap",
    },
  });

  for (const it of itemsToCreate) {
    const lineTotal = it.qty * it.unitPrice;
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: it.product.id,
        quantity: dec(it.qty),
        unitPrice: dec(it.unitPrice),
        discount: dec(0),
        total: dec(lineTotal),
      },
    });
  }

  // ===== PO DRAFT + ITEM (COMPRA) =====
  const po = await prisma.purchaseOrder.create({
    data: {
      companyId: company.id,
      supplierId: supplier.id,
      status: "DRAFT",
      notes: "PO demo criado pelo bootstrap",
    },
  });

  await prisma.purchaseOrderItem.create({
    data: {
      poId: po.id,
      materialId: mat1.id,
      quantity: dec(2),
      unitCost: dec(110),
      total: dec(220),
    },
  });

  console.log("OK: bootstrap concluido");
  console.log({
    units: [un.code, m.code, kg.code, barra.code],
    materials: [mat1.name, mat2.name, mat3.name],
    products: [prod1.name, prod2.name, prod3.name],
    client: client.name,
    supplier: supplier.name,
    orderId: order.id,
    poId: po.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
