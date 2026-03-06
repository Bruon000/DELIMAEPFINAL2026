import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = { code: string; description: string };

function detectSep(headerLine: string) {
  if (headerLine.includes(";")) return ";";
  if (headerLine.includes(",")) return ",";
  if (headerLine.includes("\t")) return "\t";
  return ";";
}

function parseCsvSimple(content: string): Row[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) return [];

  const sep = detectSep(lines[0]);
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const parts = line.split(sep);
    const code = String(parts[0] ?? "").trim();
    const description = String(parts.slice(1).join(sep) ?? "").trim(); // caso descrição tenha separador
    if (!code || !description) continue;

    rows.push({ code, description });
  }

  return rows;
}

async function upsertManyNcm(rows: Row[]) {
  // batch para não explodir memória/transação
  const BATCH = 1000;
  let done = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);

    await prisma.$transaction(
      chunk.map((r) =>
        prisma.fiscalNcm.upsert({
          where: { code: r.code } as any,
          update: { description: r.description } as any,
          create: { code: r.code, description: r.description } as any,
        } as any),
      )
    );

    done += chunk.length;
    console.log(`[NCM] ${done}/${rows.length}`);
  }
}

async function upsertManyCest(rows: Row[]) {
  const BATCH = 1000;
  let done = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);

    await prisma.$transaction(
      chunk.map((r) =>
        prisma.fiscalCest.upsert({
          where: { code: r.code } as any,
          update: { description: r.description } as any,
          create: { code: r.code, description: r.description } as any,
        } as any),
      )
    );

    done += chunk.length;
    console.log(`[CEST] ${done}/${rows.length}`);
  }
}

async function importFile(filePath: string): Promise<Row[]> {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf8");
  return parseCsvSimple(content);
}

async function main() {
  const base = path.resolve(process.cwd(), "prisma", "data");
  const ncmPath = path.join(base, "ncm.csv");
  const cestPath = path.join(base, "cest.csv");

  console.log("Using:", { ncmPath, cestPath });

  const ncmRows = await importFile(ncmPath);
  const cestRows = await importFile(cestPath);

  if (ncmRows.length === 0) console.log("[NCM] arquivo ausente ou vazio.");
  if (cestRows.length === 0) console.log("[CEST] arquivo ausente ou vazio.");

  if (ncmRows.length > 0) await upsertManyNcm(ncmRows);
  if (cestRows.length > 0) await upsertManyCest(cestRows);

  console.log("Import concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
