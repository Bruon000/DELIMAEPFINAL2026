-- AlterTable
ALTER TABLE "FiscalInvoice" ADD COLUMN     "inutilizedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FiscalInutilization" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "serie" INTEGER NOT NULL,
    "numberStart" INTEGER NOT NULL,
    "numberEnd" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalId" TEXT,
    "response" JSONB,
    "requestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalInutilization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalInutilization_companyId_docType_idx" ON "FiscalInutilization"("companyId", "docType");

-- AddForeignKey
ALTER TABLE "FiscalInutilization" ADD CONSTRAINT "FiscalInutilization_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
