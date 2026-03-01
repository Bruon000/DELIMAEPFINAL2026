import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { id: "seed-company-1" },
    update: {},
    create: {
      id: "seed-company-1",
      name: "Serralheria Demo",
      document: "00.000.000/0001-00",
      email: "contato@serralheria.demo",
      phone: "(11) 99999-9999",
      isActive: true,
    },
  });

  const unit = await prisma.unitOfMeasure.upsert({
    where: { id: "seed-unit-un" },
    update: {},
    create: {
      id: "seed-unit-un",
      companyId: company.id,
      code: "UN",
      name: "Unidade",
      isActive: true,
    },
  });

  await prisma.unitOfMeasure.upsert({
    where: { id: "seed-unit-m" },
    update: {},
    create: {
      id: "seed-unit-m",
      companyId: company.id,
      code: "M",
      name: "Metro",
      isActive: true,
    },
  });

  const category = await prisma.category.upsert({
    where: { id: "seed-cat-1" },
    update: {},
    create: {
      id: "seed-cat-1",
      companyId: company.id,
      name: "Portões",
      slug: "portoes",
      isActive: true,
    },
  });

  const material = await prisma.material.upsert({
    where: { id: "seed-mat-1" },
    update: {},
    create: {
      id: "seed-mat-1",
      companyId: company.id,
      unitId: unit.id,
      code: "CH-001",
      name: "Chapa de ferro",
      currentCost: 45.5,
      minStock: 10,
      isActive: true,
    },
  });

  const product = await prisma.product.upsert({
    where: { id: "seed-prod-1" },
    update: {},
    create: {
      id: "seed-prod-1",
      companyId: company.id,
      categoryId: category.id,
      unitId: unit.id,
      code: "PORT-001",
      name: "Portão padrão",
      type: "COMPOSTO",
      salePrice: 1200,
      costPrice: 800,
      markup: 50,
      isActive: true,
    },
  });

  await prisma.bOM.upsert({
    where: { productId: product.id },
    update: {},
    create: {
      productId: product.id,
      lossPercent: 5,
      items: {
        create: [
          {
            materialId: material.id,
            quantity: 2.5,
          },
        ],
      },
    },
  });

  await prisma.stockItem.upsert({
    where: { materialId: material.id },
    update: {},
    create: {
      materialId: material.id,
      quantity: 100,
      reserved: 0,
    },
  });

  const client = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    update: {},
    create: {
      id: "seed-client-1",
      companyId: company.id,
      name: "Cliente Demo",
      document: "000.000.000-00",
      email: "cliente@demo.com",
      phone: "(11) 98888-8888",
      isActive: true,
    },
  });

  console.log("Seed concluído:", {
    company: company.name,
    units: 2,
    category: category.name,
    material: material.name,
    product: product.name,
    client: client.name,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
