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

  // ==== CLIENTE BALCÃO (WALKIN) ====
  // Usado no PDV quando o cliente não quer cadastro -> padrão NFCE.
  const walkinDoc = "WALKIN";
  const walkinName = "CONSUMIDOR FINAL (BALCÃO)";

  const existingWalkin = await prisma.client.findFirst({
    where: { companyId: company.id, document: walkinDoc, deletedAt: null } as any,
    select: { id: true } as any,
  } as any);

  if (!existingWalkin) {
    await prisma.client.create({
      data: {
        id: `cli_walkin_${company.id}`,
        companyId: company.id,
        name: walkinName,
        document: walkinDoc,
        isActive: true,
      } as any,
    } as any);
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

  // =========================
  // FISCAL (stub/seeds simples)
  // =========================
  // Obs: isso NÃO incrementa número de série. Apenas cadastra defaults.

  const cfops = [
    { code: "5101", description: "VENDA DE PRODUÇÃO DO ESTABELECIMENTO" },
    { code: "6101", description: "VENDA DE PRODUÇÃO DO ESTABELECIMENTO (OUTRA UF)" },
    { code: "5102", description: "VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS" },
    { code: "6102", description: "VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS (OUTRA UF)" },
  ];

  for (const c of cfops) {
    await prisma.fiscalCfop.upsert({
      where: { code: c.code } as any,
      update: { description: c.description } as any,
      create: { code: c.code, description: c.description } as any,
    } as any);
  }

  const csts = [
    { code: "00", description: "Tributada integralmente" },
    { code: "20", description: "Com redução de base de cálculo" },
    { code: "40", description: "Isenta" },
    { code: "41", description: "Não tributada" },
    { code: "60", description: "ICMS cobrado anteriormente por substituição tributária" },
  ];

  for (const c of csts) {
    await prisma.fiscalCst.upsert({
      where: { code: c.code } as any,
      update: { description: c.description } as any,
      create: { code: c.code, description: c.description } as any,
    } as any);
  }

  const csosns = [
    { code: "101", description: "Tributada pelo Simples Nacional com permissão de crédito" },
    { code: "102", description: "Tributada pelo Simples Nacional sem permissão de crédito" },
    { code: "103", description: "Isenção do ICMS no Simples Nacional" },
    { code: "201", description: "ST com permissão de crédito" },
    { code: "202", description: "ST sem permissão de crédito" },
    { code: "500", description: "ICMS cobrado anteriormente por ST (ou antecipação)" },
    { code: "900", description: "Outros" },
  ];

  for (const c of csosns) {
    await prisma.fiscalCsosn.upsert({
      where: { code: c.code } as any,
      update: { description: c.description } as any,
      create: { code: c.code, description: c.description } as any,
    } as any);
  }

  // NCM stub (poucos exemplos; depois a gente cria import/autocomplete robusto)
  const ncms = [
    { code: "73083000", description: "Estruturas e partes de estruturas, de ferro ou aço" },
    { code: "73089010", description: "Portas, janelas e respectivos caixilhos, de ferro ou aço" },
    { code: "73269090", description: "Outras obras de ferro ou aço" },
    { code: "76101000", description: "Estruturas e partes de estruturas, de alumínio" },
  ];

  for (const n of ncms) {
    await prisma.fiscalNcm.upsert({
      where: { code: n.code } as any,
      update: { description: n.description } as any,
      create: { code: n.code, description: n.description } as any,
    } as any);
  }

  const cests = [
    { code: "1005300", description: "Telas metálicas" },
    { code: "2804400", description: "Ferragens e artigos de metal comuns" },
  ];

  for (const x of cests) {
    await prisma.fiscalCest.upsert({
      where: { code: x.code } as any,
      update: { description: x.description } as any,
      create: { code: x.code, description: x.description } as any,
    } as any);
  }

  // ==== PERFIS FISCAIS (VÍNCULO DO PRODUTO) ====
  const taxProfiles = [
    {
      name: "ICMS Tributado - PIS/COFINS Isento",
      description: "Venda padrão com ICMS tributado; PIS/COFINS sem destaque/isento (ajustar no emissor).",
    },
    {
      name: "ICMS Tributado - PIS/COFINS Tributado",
      description: "Venda padrão com ICMS + PIS/COFINS tributados (ajustar regras no emissor).",
    },
    {
      name: "Simples Nacional (CSOSN 102)",
      description: "SN sem permissão de crédito (CSOSN 102).",
    },
    {
      name: "Simples Nacional (CSOSN 101)",
      description: "SN com permissão de crédito (CSOSN 101).",
    },
    {
      name: "ICMS ST (Substituição Tributária)",
      description: "Operação com ST (depende do produto/estado; ajuste no emissor).",
    },
  ];

  for (const p of taxProfiles) {
    await prisma.fiscalTaxProfile.upsert({
      where: { name: p.name } as any,
      update: { description: p.description } as any,
      create: { name: p.name, description: p.description } as any,
    } as any);
  }

  const defaultCfop = await prisma.fiscalCfop.findUnique({ where: { code: "5101" } as any, select: { id: true } as any } as any);

  // FiscalConfig (1 por empresa)
  await prisma.fiscalConfig.upsert({
    where: { companyId: company.id } as any,
    update: {
      environment: "HOMOLOG" as any,
      useTradeNameOnInvoice: true,
      useTradeNameOnRecipient: true,
      showPaymentOnPrint: true,
      contingencyEnabled: false,
      icmsDesoneracaoEnabled: false,
      defaultCfopId: defaultCfop?.id ?? null,
    } as any,
    create: {
      companyId: company.id,
      environment: "HOMOLOG" as any,
      useTradeNameOnInvoice: true,
      useTradeNameOnRecipient: true,
      showPaymentOnPrint: true,
      contingencyEnabled: false,
      icmsDesoneracaoEnabled: false,
      defaultCfopId: defaultCfop?.id ?? null,
    } as any,
  } as any);

  // Séries (Softcom-like). NÃO consumimos/incrementamos aqui.
  // Se já existir, não mexe nos números (respeita o estado atual).
  const desiredSeries = [
    { model: 55, serie: 1, isDefault: true }, // NF-e
    { model: 65, serie: 1, isDefault: true }, // NFC-e
  ];

  for (const s of desiredSeries) {
    const exists = await prisma.fiscalSeries.findUnique({
      where: { companyId_model_serie: { companyId: company.id, model: s.model, serie: s.serie } } as any,
      select: { id: true } as any,
    } as any);

    if (!exists) {
      await prisma.fiscalSeries.create({
        data: {
          companyId: company.id,
          model: s.model,
          serie: s.serie,
          initialNumber: 1,
          currentNumber: 1,
          isDefault: s.isDefault,
        } as any,
      } as any);
    }
  }

  // Garantir CompanyFiscal (1:1) para cada company
  const companies = await prisma.company.findMany({ select: { id: true, name: true, document: true } } as any);
  for (const c of companies) {
    const exists = await prisma.companyFiscal.findUnique({ where: { companyId: c.id } as any, select: { id: true } as any } as any);
    if (!exists?.id) {
      await prisma.companyFiscal.create({
        data: {
          companyId: c.id,
          tradeName: c.name ?? null,
          legalName: c.name ?? null,
          crt: null,
          ie: null,
        } as any,
      } as any);
    }
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
