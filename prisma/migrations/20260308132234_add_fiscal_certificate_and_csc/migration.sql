-- AlterTable
ALTER TABLE "FiscalConfig" ADD COLUMN     "certificatePassword" TEXT,
ADD COLUMN     "certificatePfxBase64" TEXT,
ADD COLUMN     "certificateType" TEXT DEFAULT 'A1',
ADD COLUMN     "certificateUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "csc" TEXT,
ADD COLUMN     "cscId" TEXT;
