const { PrismaClient } = require("@prisma/client");

(async () => {
  const p = new PrismaClient();
  try {
    const q = await p.quote.findFirst({ orderBy: { createdAt: "desc" } });
    if (!q) {
      console.log("sem quote");
      return;
    }
    await p.quote.update({
      where: { id: q.id },
      data: { validUntil: new Date("2020-01-01") },
    });
    console.log("quote vencido:", q.id);
  } catch (e) {
    console.error("ERRO:", e?.message ?? e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
