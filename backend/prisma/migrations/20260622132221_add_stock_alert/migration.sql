-- DropIndex
DROP INDEX "StockAlert_isActive_idx";

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "priceUpdatedAt" TIMESTAMP(3);
