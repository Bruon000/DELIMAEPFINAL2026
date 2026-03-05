-- CreateEnum
CREATE TYPE "FiscalEnvironment" AS ENUM ('HOMOLOG', 'PROD');

-- AlterTable
ALTER TABLE "FiscalConfig" ADD COLUMN     "contingencyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultCfopId" TEXT,
ADD COLUMN     "environment" "FiscalEnvironment" NOT NULL DEFAULT 'HOMOLOG',
ADD COLUMN     "icmsDesoneracaoEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showPaymentOnPrint" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "useTradeNameOnInvoice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "useTradeNameOnRecipient" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "FiscalSeries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "initialNumber" INTEGER NOT NULL DEFAULT 1,
    "currentNumber" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalNcm" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalNcm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalCfop" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalCfop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalCst" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalCst_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalCsosn" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalCsosn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFiscal" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "origin" INTEGER NOT NULL DEFAULT 0,
    "ncmId" TEXT,
    "cfopId" TEXT,
    "cstId" TEXT,
    "csosnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalSeries_companyId_serie_key" ON "FiscalSeries"("companyId", "serie");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalNcm_code_key" ON "FiscalNcm"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalCfop_code_key" ON "FiscalCfop"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalCst_code_key" ON "FiscalCst"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalCsosn_code_key" ON "FiscalCsosn"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFiscal_productId_key" ON "ProductFiscal"("productId");

-- CreateIndex
CREATE INDEX "ProductFiscal_ncmId_idx" ON "ProductFiscal"("ncmId");

-- CreateIndex
CREATE INDEX "ProductFiscal_cfopId_idx" ON "ProductFiscal"("cfopId");

-- CreateIndex
CREATE INDEX "ProductFiscal_cstId_idx" ON "ProductFiscal"("cstId");

-- CreateIndex
CREATE INDEX "ProductFiscal_csosnId_idx" ON "ProductFiscal"("csosnId");

-- AddForeignKey
ALTER TABLE "FiscalConfig" ADD CONSTRAINT "FiscalConfig_defaultCfopId_fkey" FOREIGN KEY ("defaultCfopId") REFERENCES "FiscalCfop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalSeries" ADD CONSTRAINT "FiscalSeries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFiscal" ADD CONSTRAINT "ProductFiscal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFiscal" ADD CONSTRAINT "ProductFiscal_ncmId_fkey" FOREIGN KEY ("ncmId") REFERENCES "FiscalNcm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFiscal" ADD CONSTRAINT "ProductFiscal_cfopId_fkey" FOREIGN KEY ("cfopId") REFERENCES "FiscalCfop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFiscal" ADD CONSTRAINT "ProductFiscal_cstId_fkey" FOREIGN KEY ("cstId") REFERENCES "FiscalCst"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFiscal" ADD CONSTRAINT "ProductFiscal_csosnId_fkey" FOREIGN KEY ("csosnId") REFERENCES "FiscalCsosn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalInvoice" ADD CONSTRAINT "FiscalInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
