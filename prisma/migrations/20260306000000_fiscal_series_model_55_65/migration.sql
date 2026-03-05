-- AlterTable: add model (55=NF-e, 65=NFC-e) to FiscalSeries
ALTER TABLE "FiscalSeries" ADD COLUMN "model" INTEGER NOT NULL DEFAULT 55;

-- Drop old unique constraint
DROP INDEX "FiscalSeries_companyId_serie_key";

-- Create new unique constraint (companyId, model, serie)
CREATE UNIQUE INDEX "FiscalSeries_companyId_model_serie_key" ON "FiscalSeries"("companyId", "model", "serie");
