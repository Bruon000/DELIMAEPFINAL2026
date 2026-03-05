const { PrismaClient } = require("@prisma/client");
(async () => {
  const p = new PrismaClient();
  try {
    const total = await p.product.count();
    const active = await p.product.count({ where: { deletedAt: null, isActive: true } });
    console.log("Produtos total:", total);
    console.log("Produtos ativos:", active);
  } catch (e) {
    console.error("ERRO:", e?.message ?? e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
