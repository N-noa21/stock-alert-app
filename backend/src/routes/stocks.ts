import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  generateGeminiText,
  parseJsonFromGeminiText,
} from "../services/geminiService";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { calculateStockSummary } from "../services/stockSummaryService";
import { analyzeStockAlerts } from "../services/alertAnalysisService";
import {
  getCachedAiSummary,
  saveAiSummaryCache,
} from "../lib/aiSummaryCache";
import { buildTradingViewUrl } from "../lib/tradingView";


function getUserId(req: unknown): number {
  return (req as AuthenticatedRequest).user.id;
}

function roundNumber(value: number | null): number | null {
  if (value === null) {
    return null;
  }

  return Math.round(value * 100) / 100;
}

export const stocksRouter = Router();

stocksRouter.get("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);

  const stocks = await prisma.stock.findMany({
    where: {
      userId,
    },
    orderBy: {
      id: "asc",
    },
  });

  return res.json(stocks);
});

stocksRouter.post("/", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const { symbol, name, market } = req.body;

  if (typeof symbol !== "string" || symbol.length === 0) {
    return res.status(400).json({ error: "symbol is required" });
  }

  if (market !== "JP" && market !== "US") {
    return res.status(400).json({ error: "market must be JP or US" });
  }

  const stock = await prisma.stock.create({
    data: {
      userId,
      symbol,
      name: typeof name === "string" ? name : null,
      market,
    },
  });

  return res.status(201).json(stock);
});

stocksRouter.get("/ai-summary", requireAuth, async (req, res) => {
  const userId = getUserId(req);

  const stocks = await prisma.stock.findMany({
    where: {
      userId,
    },
    orderBy: {
      id: "asc",
    },
    include: {
      lots: {
        orderBy: {
          id: "asc",
        },
      },
      alerts: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (stocks.length === 0) {
    return res.json({
      summary: "登録されている銘柄はまだありません。",
      cached: false,
      cacheDate: null,
      marketSummaries: [],
      stockSummaries: [],
    });
  }

  const stockSummaries = stocks.map((stock) => {
    const summary = calculateStockSummary(stock);

    const currentPrice =
      summary.stock.currentPrice === null
        ? null
        : Number(summary.stock.currentPrice);

    const profitLossRate =
      summary.position.unrealizedProfitRate === null
        ? null
        : summary.position.unrealizedProfitRate * 100;

    return {
      id: summary.stock.id,
      symbol: summary.stock.symbol,
      name: summary.stock.name,
      market: summary.stock.market,
      currentPrice,
      priceUpdatedAt: summary.stock.priceUpdatedAt?.toISOString() ?? null,
      totalShares: summary.position.totalShares,
      totalCost: summary.position.totalCost,
      averageBuyPrice: summary.position.averageBuyPrice,
      marketValue: summary.position.marketValue,
      profitLoss: summary.position.unrealizedProfit,
      profitLossRate,
      activeAlerts: summary.alerts.active.map((alert) => ({
        id: alert.id,
        direction: alert.direction,
        targetPrice: Number(alert.targetPrice),
      })),
      triggeredAlerts: summary.alerts.triggered.map((alert) => ({
        id: alert.id,
        direction: alert.direction,
        targetPrice: Number(alert.targetPrice),
      })),
    };
  });

  const marketSummaries = ["JP", "US"].map((market) => {
    const items = stockSummaries.filter((stock) => stock.market === market);

    const totalCost = items.reduce((sum, stock) => {
      return sum + stock.totalCost;
    }, 0);

    const pricedItems = items.filter((stock) => stock.marketValue !== null);

    const totalMarketValue =
      pricedItems.length === 0
        ? null
        : pricedItems.reduce((sum, stock) => {
            return sum + (stock.marketValue ?? 0);
          }, 0);

    const totalProfitLoss =
      totalMarketValue === null ? null : totalMarketValue - totalCost;

    const totalProfitLossRate =
      totalProfitLoss === null || totalCost === 0
        ? null
        : (totalProfitLoss / totalCost) * 100;

    const triggeredAlertCount = items.reduce((sum, stock) => {
      return sum + stock.triggeredAlerts.length;
    }, 0);

    return {
      market,
      stockCount: items.length,
      pricedStockCount: pricedItems.length,
      totalCost,
      totalMarketValue,
      totalProfitLoss,
      totalProfitLossRate,
      triggeredAlertCount,
    };
  });

  const forceRefresh = req.query.refresh === "true";

  if (!forceRefresh) {
    const cached = await getCachedAiSummary({
      userId,
      type: "PORTFOLIO_SUMMARY",
    });

    if (cached) {
      return res.json({
        summary: cached.content,
        cached: true,
        cacheDate: cached.cacheDate,
        marketSummaries,
        stockSummaries,
      });
    }
  }

  const aiMarketSummaries = marketSummaries
    .filter((market) => market.stockCount > 0)
    .map((market) => ({
      market: market.market,
      stockCount: market.stockCount,
      pricedStockCount: market.pricedStockCount,
      totalCost: roundNumber(market.totalCost),
      totalMarketValue: roundNumber(market.totalMarketValue),
      totalProfitLoss: roundNumber(market.totalProfitLoss),
      totalProfitLossRate: roundNumber(market.totalProfitLossRate),
      triggeredAlertCount: market.triggeredAlertCount,
    }));

  const aiStockSummaries = stockSummaries
    .filter((stock) => {
      return (
        stock.totalShares > 0 ||
        stock.activeAlerts.length > 0 ||
        stock.triggeredAlerts.length > 0
      );
    })
    .map((stock) => ({
      symbol: stock.symbol,
      name: stock.name,
      market: stock.market,
      currentPrice: roundNumber(stock.currentPrice),
      totalShares: roundNumber(stock.totalShares),
      averageBuyPrice: roundNumber(stock.averageBuyPrice),
      marketValue: roundNumber(stock.marketValue),
      profitLoss: roundNumber(stock.profitLoss),
      profitLossRate: roundNumber(stock.profitLossRate),
      activeAlertCount: stock.activeAlerts.length,
      triggeredAlertCount: stock.triggeredAlerts.length,
    }));

  const prompt = `
あなたは株式ポートフォリオ管理アプリのAIサマリー担当です。
以下のデータから、日本語で現在の保有状況レポートを書いてください。

ルール:
- 投資助言や売買推奨はしない。
- 銘柄一覧や市場構成の紹介ではなく、現在見るべき状態にフォーカスする。
- 重要度の高い順に、損益、アラート、確認ポイントを整理する。
- 保有株数0の銘柄は原則詳しく説明しない。
- JPとUSは通貨が違うため金額を直接合算しない。
- 4〜6文で簡潔に書く。
- 最後に「これは投資助言ではなく、保有状況の整理です。」という趣旨を含める。

市場別集計:
${JSON.stringify(aiMarketSummaries)}

銘柄別データ:
${JSON.stringify(aiStockSummaries)}
`;

  try {
    const summary = await generateGeminiText(prompt);

    const cache = await saveAiSummaryCache({
      userId,
      type: "PORTFOLIO_SUMMARY",
      content: summary,
    });

    return res.json({
      summary: cache.content,
      cached: false,
      cacheDate: cache.cacheDate,
      marketSummaries,
      stockSummaries,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "failed to generate portfolio AI summary",
    });
  }
});

stocksRouter.get("/alerts/ai-summary",requireAuth, async (req, res) => {
  const userId = getUserId(req);

  const rawThresholdRate = req.query.thresholdRate;

  const thresholdRate =
    typeof rawThresholdRate === "string" ? Number(rawThresholdRate) : 5;

  if (!Number.isFinite(thresholdRate) || thresholdRate < 0) {
    return res.status(400).json({
      error: "thresholdRate must be a non-negative number",
    });
  }

  const stocks = await prisma.stock.findMany({
    where: {
      userId,
    },
    orderBy: {
      id: "asc",
    },
    include: {
      alerts: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  const {
    importantAlerts,
    closestAlerts,
  } = analyzeStockAlerts(stocks, thresholdRate);


  const forceRefresh = req.query.refresh === "true";
  
  if (!forceRefresh) {
    const cached = await getCachedAiSummary({
      userId,
      type: "ALERTS_SUMMARY",
    });
  
    if (cached) {
      return res.json({
        summary: cached.content,
        thresholdRate,
        cached: true,
        cacheDate: cached.cacheDate,
        importantAlerts,
        closestAlerts,
      });
    }
  }

  const aiImportantAlerts = importantAlerts.map((alert) => ({
    symbol: alert.symbol,
    name: alert.name,
    market: alert.market,
    currentPrice: roundNumber(alert.currentPrice),
    direction: alert.direction,
    targetPrice: roundNumber(alert.targetPrice),
    isTriggered: alert.isTriggered,
    priceDiffToTrigger: roundNumber(alert.priceDiffToTrigger),
    distanceRateToTrigger: roundNumber(alert.distanceRateToTrigger),
    status: alert.status,
  }));

  const aiClosestAlerts = closestAlerts.map((alert) => ({
    symbol: alert.symbol,
    name: alert.name,
    market: alert.market,
    currentPrice: roundNumber(alert.currentPrice),
    direction: alert.direction,
    targetPrice: roundNumber(alert.targetPrice),
    isTriggered: alert.isTriggered,
    priceDiffToTrigger: roundNumber(alert.priceDiffToTrigger),
    distanceRateToTrigger: roundNumber(alert.distanceRateToTrigger),
    status: alert.status,
  }));




  const prompt = `
    あなたは株式ポートフォリオ管理アプリのAIサマリー担当です。
    以下のアラート分析データをもとに、日本語でアラート状況を簡潔に説明してください。

    重要:
    - 投資助言や売買推奨はしないでください。
    - 「買うべき」「売るべき」「必ず上がる」などの断定は避けてください。
    - アラートに近い銘柄、すでに発火している銘柄、確認すべき価格水準を中心に説明してください。
    - 近いアラートがない場合は、最も近いアラートを簡単に紹介しつつ、現時点では大きく近接していないことを説明してください。
    - 日本株と米国株は通貨が違うため、金額を直接比較しないでください。
    - 3〜5文程度で簡潔に書いてください。
    - 最後に「これは投資助言ではなく、アラート状況の整理です。」という趣旨を自然に含めてください。

    近いとみなす閾値:
    ${thresholdRate}%

    重要なアラート:
    ${JSON.stringify(aiImportantAlerts)}

    近い順のアラート:
    ${JSON.stringify(aiClosestAlerts)}`;

  try {
    const summary = await generateGeminiText(prompt);

    const cache = await saveAiSummaryCache({
      userId,
      type: "ALERTS_SUMMARY",
      content: summary,
    });

    return res.json({
      summary: cache.content,
      thresholdRate,
      cached: false,
      cacheDate: cache.cacheDate,
      importantAlerts,
      closestAlerts,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "failed to generate alert AI summary",
    });
  }
});

stocksRouter.get("/:id/ai-summary", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const stockId = Number(req.params.id);

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  const stock = await prisma.stock.findFirst({
    where: {
      id: stockId,
      userId,
    },
    include: {
      lots: {
        orderBy: {
          id: "asc",
        },
      },
      alerts: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (stock === null) {
    return res.status(404).json({ error: "stock not found" });
  }

  const summaryData = calculateStockSummary(stock);

  const aiStockSummary = {
    symbol: summaryData.stock.symbol,
    name: summaryData.stock.name,
    market: summaryData.stock.market,
    currentPrice:
      summaryData.stock.currentPrice === null
        ? null
        : Number(summaryData.stock.currentPrice),
    priceUpdatedAt: summaryData.stock.priceUpdatedAt?.toISOString() ?? null,
    position: summaryData.position,
    alerts: {
      activeAlertCount: summaryData.alerts.active.length,
      triggeredAlertCount: summaryData.alerts.triggered.length,
      activeAlerts: summaryData.alerts.active.slice(0, 5).map((alert) => ({
        direction: alert.direction,
        targetPrice: Number(alert.targetPrice),
      })),
    },
  };

  const prompt = `
    あなたは株式ポートフォリオ管理アプリのAIサマリー担当です。
    以下のデータから、この銘柄の現在の保有状況を日本語で要約してください。

    ルール:
    - 投資助言や売買推奨はしない。
    - 中長期保有の管理目線で、損益、現在価格、アラート状況を整理する。
    - 保有株数が0の場合は、損益ではなく管理状態として簡潔に説明する。
    - 3〜5文で簡潔に書く。

    銘柄データ:
    ${JSON.stringify(aiStockSummary)}
  `;

  try {
    const summary = await generateGeminiText(prompt);

    return res.json({
      stockId: stock.id,
      summary,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "failed to generate AI summary",
    });
  }
});



stocksRouter.get("/:id/summary", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const stockId = Number(req.params.id);

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  const stock = await prisma.stock.findFirst({
    where: {
      id: stockId,
      userId,
    },
    include: {
      lots: {
        orderBy: {
          id: "asc",
        },
      },
      alerts: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (!stock) {
    return res.status(404).json({ error: "stock not found" });
  }

  const summary = calculateStockSummary(stock);

  return res.json({
    ...summary,
    stock: {
      ...summary.stock,
      tradingViewUrl: buildTradingViewUrl({
        symbol: stock.symbol,
        market: stock.market,
      }),
    },
  });
});

stocksRouter.post("/:id/alerts", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const stockId = Number(req.params.id);
  const { direction, targetPrice } = req.body;

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  if (direction !== "ABOVE" && direction !== "BELOW") {
    return res.status(400).json({
      error: "direction must be ABOVE or BELOW",
    });
  }

  if (
    typeof targetPrice !== "number" ||
    !Number.isFinite(targetPrice) ||
    targetPrice <= 0
  ) {
    return res.status(400).json({
      error: "targetPrice must be a positive number",
    });
  }

  const stock = await prisma.stock.findFirst({
    where: {
      id: stockId,
      userId,
    },
  });

  if (stock === null) {
    return res.status(404).json({ error: "stock not found" });
  }

  const alert = await prisma.stockAlert.create({
    data: {
      stockId,
      direction,
      targetPrice: targetPrice.toString(),
    },
  });

  return res.status(201).json(alert);
});

stocksRouter.post("/:id/alerts/from-text", async (req, res) => {
  const userId = getUserId(req);
  const stockId = Number(req.params.id);
  const { text } = req.body;

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "text is required" });
  }

  const stock = await prisma.stock.findFirst({
    where: {
      id: stockId,
      userId,
    },
  });

  if (stock === null) {
    return res.status(404).json({ error: "stock not found" });
  }

  const prompt = `
あなたは株価アラート作成機能の自然文解析担当です。
ユーザーの文章を読み、株価アラート条件をJSONに変換してください。

対象銘柄:
- symbol: ${stock.symbol}
- name: ${stock.name ?? "未設定"}
- market: ${stock.market}

ユーザー入力:
${text}

ルール:
- 出力はJSONのみ。説明文やMarkdownは不要です。
- direction は "ABOVE" または "BELOW" のどちらかにしてください。
- 「超えたら」「以上」「上回ったら」「高くなったら」は ABOVE です。
- 「下回ったら」「以下」「割れたら」「安くなったら」は BELOW です。
- targetPrice は数値にしてください。
- 価格が読み取れない場合は direction と targetPrice を null にしてください。
- 曖昧でアラート条件に変換できない場合も null にしてください。

出力形式:
{
  "direction": "ABOVE" | "BELOW" | null,
  "targetPrice": number | null
}
`;

  try {
    const summary = await generateGeminiText(prompt);

    const parsed = parseJsonFromGeminiText(summary ?? "");

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("direction" in parsed) ||
      !("targetPrice" in parsed)
    ) {
      return res.status(400).json({
        error: "failed to parse alert condition",
      });
    }

    const direction = parsed.direction;
    const targetPrice = parsed.targetPrice;

    if (direction !== "ABOVE" && direction !== "BELOW") {
      return res.status(400).json({
        error: "アラート方向を読み取れませんでした。例: 3000円を超えたら通知",
        parsed,
      });
    }

    if (typeof targetPrice !== "number" || !Number.isFinite(targetPrice) || targetPrice <= 0) {
      return res.status(400).json({
        error: "目標価格を読み取れませんでした。例: 3000円を超えたら通知",
        parsed,
      });
    }

    const alert = await prisma.stockAlert.create({
      data: {
        stockId,
        direction,
        targetPrice: targetPrice.toString(),
      },
    });

    return res.status(201).json({
      alert,
      parsed: {
        direction,
        targetPrice,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "failed to create alert from text",
    });
  }
});

stocksRouter.get("/:id/lots", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const stockId = Number(req.params.id);

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  const stock = await prisma.stock.findFirst({
    where: {
      id: stockId,
      userId,
    },
  });

  if (!stock) {
    return res.status(404).json({ error: "stock not found" });
  }

  const lots = await prisma.stockLot.findMany({
    where: {
      stockId,
    },
    orderBy: {
      id: "asc",
    },
  });

  return res.json(lots);
});

stocksRouter.post("/:id/lots", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const stockId = Number(req.params.id);
  const { quantity, buyPrice } = req.body;

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return res.status(400).json({
      error: "quantity must be a positive integer",
    });
  }

  const buyPriceNumber = Number(buyPrice);

  if (!Number.isFinite(buyPriceNumber) || buyPriceNumber <= 0) {
    return res.status(400).json({
      error: "buyPrice must be a positive number",
    });
  }

  const stock = await prisma.stock.findFirst({
    where: {
      id: stockId,
      userId,
    },
  });

  if (!stock) {
    return res.status(404).json({ error: "stock not found" });
  }

  const lot = await prisma.stockLot.create({
    data: {
      stockId,
      quantity,
      buyPrice: buyPriceNumber,
    },
  });

  return res.status(201).json(lot);
});

stocksRouter.delete("/:stockId/lots/:lotId", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const stockId = Number(req.params.stockId);
  const lotId = Number(req.params.lotId);

  if (!Number.isInteger(stockId) || !Number.isInteger(lotId)) {
    return res.status(400).json({ error: "invalid id" });
  }

  const lot = await prisma.stockLot.findFirst({
    where: {
      id: lotId,
      stockId,
      stock: {
        userId,
      },
    },
  });

  if (!lot) {
    return res.status(404).json({ error: "lot not found" });
  }

  await prisma.stockLot.delete({
    where: {
      id: lotId,
    },
  });

  return res.status(204).send();
});


stocksRouter.delete("/:stockId/alerts/:alertId", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const stockId = Number(req.params.stockId);
  const alertId = Number(req.params.alertId);

  if (!Number.isInteger(stockId) || !Number.isInteger(alertId)) {
    return res.status(400).json({ error: "invalid id" });
  }

  const alert = await prisma.stockAlert.findFirst({
    where: {
      id: alertId,
      stockId,
      stock: {
        userId,
      },
    },
  });

  if (!alert) {
    return res.status(404).json({ error: "alert not found" });
  }

  await prisma.stockAlert.delete({
    where: {
      id: alertId,
    },
  });

  return res.status(204).send();
});



stocksRouter.get("/:id", requireAuth, async (req, res) => {
  const userId = getUserId(req);
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  const stock = await prisma.stock.findFirst({
    where: {
      id,
      userId,
    },
    include: {
      lots: {
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  if (stock === null) {
    return res.status(404).json({ error: "stock not found" });
  }

  const totalQuantity = stock.lots.reduce((sum, lot) => {
    return sum + lot.quantity;
  }, 0);

  const totalCost = stock.lots.reduce((sum, lot) => {
    return sum + lot.quantity * lot.buyPrice;
  }, 0);

  const averageBuyPrice =
    totalQuantity === 0 ? null : totalCost / totalQuantity;

  return res.json({
    ...stock,
    tradingViewUrl: buildTradingViewUrl({
      symbol: stock.symbol,
      market: stock.market,
    }),
    totalQuantity,
    totalCost,
    averageBuyPrice,
  });
});


stocksRouter.patch("/:id/price", async (req, res) => {
  const stockId = Number(req.params.id);

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  const { currentPrice } = req.body;

  if (
    typeof currentPrice !== "number" ||
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0
  ) {
    return res.status(400).json({ error: "currentPrice must be a positive number" });
  }

  try {
    const stock = await prisma.stock.update({
      where: {
        id: stockId,
      },
      data: {
        currentPrice,
        priceUpdatedAt: new Date(),
      },
    });

    return res.json(stock);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ error: "stock not found" });
    }

    return res.status(500).json({ error: "failed to update stock price" });
  }
});