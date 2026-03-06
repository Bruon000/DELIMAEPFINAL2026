-- AlterTable
ALTER TABLE "FiscalConfig" ADD COLUMN "provider" TEXT DEFAULT 'MOCK';
ALTER TABLE "FiscalConfig" ADD COLUMN "providerToken" TEXT;
