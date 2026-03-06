-- CreateTable
CREATE TABLE "FiscalTaxProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalTaxProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalTaxProfile_name_key" ON "FiscalTaxProfile"("name");

-- AlterTable
ALTER TABLE "ProductFiscal" ADD COLUMN "taxProfileId" TEXT;

-- CreateIndex
CREATE INDEX "ProductFiscal_taxProfileId_idx" ON "ProductFiscal"("taxProfileId");

-- AddForeignKey
ALTER TABLE "ProductFiscal" ADD CONSTRAINT "ProductFiscal_taxProfileId_fkey" FOREIGN KEY ("taxProfileId") REFERENCES "FiscalTaxProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
