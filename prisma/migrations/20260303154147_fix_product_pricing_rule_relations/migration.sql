-- CreateTable
CREATE TABLE "ProductPricingRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mode" "PricingMode" NOT NULL,
    "rounding" "PriceRounding" NOT NULL,
    "marginPercent" DECIMAL(5,2),
    "markupPercent" DECIMAL(5,2),
    "overheadPercent" DECIMAL(5,2),
    "feesPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductPricingRule_productId_key" ON "ProductPricingRule"("productId");

-- AddForeignKey
ALTER TABLE "ProductPricingRule" ADD CONSTRAINT "ProductPricingRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPricingRule" ADD CONSTRAINT "ProductPricingRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
