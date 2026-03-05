const { PrismaClient } = require("@prisma/client");
(async () => {
  const p = new PrismaClient();
  try {
    const products = await p.product.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true, companyId: true },
      take: 20,
    });

    const companies = {};
    for (const pr of products) companies[pr.companyId] = (companies[pr.companyId] || 0) + 1;

    console.log("Produtos ativos por companyId:", companies);

    const users = await p.user.findMany({
      where: { deletedAt: null },
      select: { id: true, email: true, role: true, companyId: true },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    console.log("Ultimos users (email/role/companyId):");
    for (const u of users.slice(0, 10)) {
      console.log("-", u.email, u.role, u.companyId);
    }
  } catch (e) {
    console.error("ERRO:", e?.message ?? e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
