-- Tabela para mapear códigos/nomes de fornecedor para um Material interno

CREATE TABLE "MaterialSupplierRef" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "materialId" TEXT NOT NULL,
  "supplierId" TEXT,
  "code" TEXT,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaterialSupplierRef_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MaterialSupplierRef"
  ADD CONSTRAINT "MaterialSupplierRef_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaterialSupplierRef"
  ADD CONSTRAINT "MaterialSupplierRef_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaterialSupplierRef"
  ADD CONSTRAINT "MaterialSupplierRef_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MaterialSupplierRef_companyId_supplierId_code_idx"
  ON "MaterialSupplierRef"("companyId", "supplierId", "code");

CREATE INDEX "MaterialSupplierRef_companyId_code_idx"
  ON "MaterialSupplierRef"("companyId", "code");

