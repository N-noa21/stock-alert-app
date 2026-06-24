import { prisma } from "./prisma";
import { getTodayJstDateKey } from "./date";

type AiSummaryType = "PORTFOLIO_SUMMARY" | "ALERTS_SUMMARY";

export async function getCachedAiSummary(params: {
  userId: number;
  type: AiSummaryType;
}) {
  const cacheDate = getTodayJstDateKey();

  return prisma.aiSummaryCache.findUnique({
    where: {
      userId_type_cacheDate: {
        userId: params.userId,
        type: params.type,
        cacheDate,
      },
    },
  });
}

export async function saveAiSummaryCache(params: {
  userId: number;
  type: AiSummaryType;
  content: string;
}) {
  const cacheDate = getTodayJstDateKey();

  return prisma.aiSummaryCache.upsert({
    where: {
      userId_type_cacheDate: {
        userId: params.userId,
        type: params.type,
        cacheDate,
      },
    },
    update: {
      content: params.content,
    },
    create: {
      userId: params.userId,
      type: params.type,
      cacheDate,
      content: params.content,
    },
  });
}