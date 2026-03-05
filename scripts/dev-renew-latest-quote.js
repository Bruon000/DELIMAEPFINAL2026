const { PrismaClient } = require("@prisma/client");

(async () => {
  const p = new PrismaClient();
  try {
    const q = await p.quote.findFirst({ orderBy: { createdAt: "desc" } });
    if (!q) {
      console.log("sem quote");
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() + 15);
    await p.quote.update({
      where: { id: q.id },
      data: { validUntil: d },
    });
    console.log("quote renovado:", q.id, "validUntil:", d.toISOString());
  } catch (e) {
    console.error("ERRO:", e?.message ?? e);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
