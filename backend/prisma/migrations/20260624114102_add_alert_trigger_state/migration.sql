-- AlterTable
ALTER TABLE "StockAlert" ADD COLUMN     "lastNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "triggeredAt" TIMESTAMP(3);
