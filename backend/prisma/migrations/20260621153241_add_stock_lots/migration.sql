-- DropIndex
DROP INDEX "Stock_symbol_market_key";

-- CreateTable
CREATE TABLE "StockLot" (
    "id" SERIAL NOT NULL,
    "stockId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "buyPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockLot_stockId_idx" ON "StockLot"("stockId");

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
