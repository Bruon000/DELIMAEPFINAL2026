-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "cityCodeIbge" TEXT;

-- AlterTable
ALTER TABLE "FiscalInvoice" ALTER COLUMN "docType" DROP DEFAULT;

-- CreateTable
CREATE TABLE "CompanyFiscal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ie" TEXT,
    "crt" INTEGER,
    "legalName" TEXT,
    "tradeName" TEXT,
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressDistrict" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressZip" TEXT,
    "cityCodeIbge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyFiscal_companyId_key" ON "CompanyFiscal"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyFiscal" ADD CONSTRAINT "CompanyFiscal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
