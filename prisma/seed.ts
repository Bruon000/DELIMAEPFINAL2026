import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

  
  // Seed: unidades padrão
  const units = [
    { code: "un", name: "Unidade" },
    { code: "m", name: "Metro" },
    { code: "m2", name: "Metro quadrado" },
    { code: "kg", name: "Quilograma" },
    { code: "l", name: "Litro" },
    { code: "barra", name: "Barra" },
  ];

  for (const u of units) {
    const exists = await prisma.unitOfMeasure.findFirst({
      where: { companyId: company.id, code: u.code },
      select: { id: true },
    });

    if (!exists) {
      await prisma.unitOfMeasure.create({
        data: { companyId: company.id, code: u.code, name: u.name, isActive: true },
      });
    }
  }
const passwordHash = await bcrypt.hash("admin123", 10);

  const existing = await prisma.user.findFirst({
    where: { email: "admin@demo.com" },
    select: { id: true },
  });

  if (existing?.id) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: "Admin Demo",
        role: "ADMIN",
        companyId: company.id,
        isActive: true,
        passwordHash,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        id: "seed-user-admin-1",
        email: "admin@demo.com",
        name: "Admin Demo",
        role: "ADMIN",
        companyId: company.id,
        isActive: true,
        passwordHash,
      },
    });
  }

  console.log("Seed OK:", { admin: "admin@demo.com / admin123", company: company.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

