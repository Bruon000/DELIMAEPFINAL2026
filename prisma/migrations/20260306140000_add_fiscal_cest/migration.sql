-- CreateTable
CREATE TABLE "FiscalCest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalCest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalCest_code_key" ON "FiscalCest"("code");

-- AlterTable
ALTER TABLE "ProductFiscal" ADD COLUMN "cestId" TEXT;

-- CreateIndex
CREATE INDEX "ProductFiscal_cestId_idx" ON "ProductFiscal"("cestId");

-- AddForeignKey
ALTER TABLE "ProductFiscal" ADD CONSTRAINT "ProductFiscal_cestId_fkey" FOREIGN KEY ("cestId") REFERENCES "FiscalCest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
