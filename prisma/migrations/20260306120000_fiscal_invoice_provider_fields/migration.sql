-- Add new columns (docType with default for existing row)
ALTER TABLE "FiscalInvoice" ADD COLUMN "docType" TEXT NOT NULL DEFAULT 'NFE';
ALTER TABLE "FiscalInvoice" ADD COLUMN "model" INTEGER;
ALTER TABLE "FiscalInvoice" ADD COLUMN "externalId" TEXT;
ALTER TABLE "FiscalInvoice" ADD COLUMN "serie" INTEGER;
ALTER TABLE "FiscalInvoice" ADD COLUMN "pdfUrl" TEXT;
ALTER TABLE "FiscalInvoice" ADD COLUMN "xmlUrl" TEXT;

-- Backfill docType from type for existing data
UPDATE "FiscalInvoice" SET "docType" = CASE
  WHEN "type" = 'NF-E' THEN 'NFE'
  WHEN "type" = 'NFS-E' THEN 'NFSE'
  ELSE COALESCE("type", 'NFE')
END WHERE "type" IS NOT NULL;

-- Remove default so new rows must set docType explicitly (optional; keeps default for simplicity)
-- ALTER TABLE "FiscalInvoice" ALTER COLUMN "docType" DROP DEFAULT;

-- Drop old unique constraint and type column
DROP INDEX "FiscalInvoice_companyId_type_key_key";
ALTER TABLE "FiscalInvoice" DROP COLUMN "type";

-- New unique and index
CREATE UNIQUE INDEX "FiscalInvoice_companyId_docType_key_key" ON "FiscalInvoice"("companyId", "docType", "key");
CREATE INDEX "FiscalInvoice_companyId_docType_status_idx" ON "FiscalInvoice"("companyId", "docType", "status");
