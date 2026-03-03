-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('MARKUP', 'MARGIN');

-- CreateEnum
CREATE TYPE "PriceRounding" AS ENUM ('R99', 'R05', 'NONE');

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "defaultMode" "PricingMode" NOT NULL DEFAULT 'MARGIN',
    "defaultMarginPercent" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "defaultMarkupPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "rounding" "PriceRounding" NOT NULL DEFAULT 'R99',
    "minMarginPercent" DECIMAL(5,2),
    "overheadPercent" DECIMAL(5,2),
    "feesPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingConfig_companyId_key" ON "PricingConfig"("companyId");

-- AddForeignKey
ALTER TABLE "PricingConfig" ADD CONSTRAINT "PricingConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
