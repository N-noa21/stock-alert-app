/*
  Warnings:

  - A unique constraint covering the columns `[userId,symbol,market]` on the table `Stock` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Stock` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "userId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Stock_userId_idx" ON "Stock"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Stock_userId_symbol_market_key" ON "Stock"("userId", "symbol", "market");

-- AddForeignKey
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
