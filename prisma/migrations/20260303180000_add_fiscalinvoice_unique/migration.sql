-- CreateIndex
CREATE UNIQUE INDEX "FiscalInvoice_companyId_type_key_key" ON "FiscalInvoice"("companyId", "type", "key");
