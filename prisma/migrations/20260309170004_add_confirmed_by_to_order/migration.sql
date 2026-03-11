-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "confirmedById" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
