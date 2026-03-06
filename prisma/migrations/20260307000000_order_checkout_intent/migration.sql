-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'PIX', 'CARD', 'TRANSFER', 'OTHER');
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER');
CREATE TYPE "FiscalDocType" AS ENUM ('NFE', 'NFCE', 'CTE', 'MDFE', 'NFSE');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "sentToCashierAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "requestedDocType" "FiscalDocType";
ALTER TABLE "Order" ADD COLUMN "paymentMethod" "PaymentMethod";
ALTER TABLE "Order" ADD COLUMN "cardBrand" "CardBrand";
ALTER TABLE "Order" ADD COLUMN "installments" INTEGER;
ALTER TABLE "Order" ADD COLUMN "paymentNote" TEXT;
