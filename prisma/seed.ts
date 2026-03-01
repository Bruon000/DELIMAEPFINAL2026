import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { id: "seed-company-1" },
    update: {
      name: "Serralheria Demo",
      document: "00.000.000/0001-00",
      email: "contato@serralheria.demo",
      phone: "(11) 99999-9999",
      isActive: true,
    },
    create: {
      id: "seed-company-1",
      name: "Serralheria Demo",
      document: "00.000.000/0001-00",
      email: "contato@serralheria.demo",
      phone: "(11) 99999-9999",
      isActive: true,
    },
  } as any);

  // ==== UNIDADES PADRAO ====
  const units = [
    { code: "un", name: "Unidade" },
    { code: "m", name: "Metro" },
    { code: "kg", name: "Quilograma" },
    { code: "l", name: "Litro" },
    { code: "barra", name: "Barra" },
  ];

  for (const u of units) {
    const existing = await prisma.unitOfMeasure.findFirst({
      where: { companyId: company.id, code: u.code },
      select: { id: true },
    } as any);

    if (!existing) {
      await prisma.unitOfMeasure.create({
        data: { companyId: company.id, code: u.code, name: u.name, isActive: true } as any,
      } as any);
    }
  }

  const passwordHash = await bcrypt.hash("admin123", 10);

  // Seu schema pode ou não ter email como unique — então fazemos findFirst + upsert por id fixo
  const existingAdmin = await prisma.user.findFirst({
    where: { email: "admin@demo.com" },
    select: { id: true },
  } as any);

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id } as any,
      data: { name: "Admin Demo", role: "ADMIN" as any, companyId: company.id, isActive: true, passwordHash } as any,
    } as any);
  } else {
    await prisma.user.create({
      data: {
        email: "admin@demo.com",
        name: "Admin Demo",
        role: "ADMIN" as any,
        companyId: company.id,
        isActive: true,
        passwordHash,
      } as any,
    } as any);
  }

  console.log("Seed OK:", {
    admin: "admin@demo.com / admin123",
    company: company.name,
    units: units.map((u) => u.code).join(", "),
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
