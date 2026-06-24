-- CreateEnum
CREATE TYPE "AiSummaryType" AS ENUM ('PORTFOLIO_SUMMARY', 'ALERTS_SUMMARY');

-- CreateTable
CREATE TABLE "AiSummaryCache" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "AiSummaryType" NOT NULL,
    "cacheDate" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSummaryCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiSummaryCache_userId_type_cacheDate_idx" ON "AiSummaryCache"("userId", "type", "cacheDate");

-- CreateIndex
CREATE UNIQUE INDEX "AiSummaryCache_userId_type_cacheDate_key" ON "AiSummaryCache"("userId", "type", "cacheDate");

-- AddForeignKey
ALTER TABLE "AiSummaryCache" ADD CONSTRAINT "AiSummaryCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
