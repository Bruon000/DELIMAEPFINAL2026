const { PrismaClient } = require("@prisma/client");
(async () => {
  const p = new PrismaClient();
  try {
    const q = await p.quote.findFirst({ orderBy: { createdAt: "desc" } });
    if (!q) return console.log("sem quote");
    await p.quote.update({ where: { id: q.id }, data: { validUntil: new Date("2020-01-01") } });
    console.log("quote vencido:", q.id);
  } finally {
    await p.$disconnect();
  }
})();
