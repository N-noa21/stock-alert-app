import { Router } from "express";
import { prisma } from "../lib/prisma";
import { gemini } from "../lib/gemini";

function parseJsonFromGeminiText(text: string): unknown {
  const trimmed = text.trim();

  const cleaned = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

export const stocksRouter = Router();

stocksRouter.get("/",async (_req,res) => {
    const stocks = await prisma.stock.findMany({
        orderBy: {
            id: "asc",
        },
    });

    return res.json(stocks);
});

stocksRouter.post("/",async (req,res) => {
    const {symbol,name,market} = req.body;

    if (typeof symbol !== "string" || symbol.length === 0) {
        return res.status(400).json({error:"symbol is required"});
    }

    if (market !== "JP" && market !== "US") {
        return res.status(400).json({error:"market must be JP or US"});
    }

    try {
        const stock = await prisma.stock.create({
            data: {
                symbol,
                name: typeof name === "string" ? name:null,
                market,
            },
        });

        return res.status(201).json(stock);
    } catch (error) {
        return res.status(500).json({error:"failed to create stock"});
    }

});

stocksRouter.get("/ai-summary", async (_req, res) => {
  const stocks = await prisma.stock.findMany({
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
    });
  }

  const stockSummaries = stocks.map((stock) => {
    const totalShares = stock.lots.reduce((sum, lot) => {
      return sum + Number(lot.quantity);
    }, 0);

    const totalCost = stock.lots.reduce((sum, lot) => {
      return sum + Number(lot.quantity) * Number(lot.buyPrice);
    }, 0);

    const averageBuyPrice = totalShares === 0 ? null : totalCost / totalShares;

    const currentPrice =
      stock.currentPrice === null ? null : Number(stock.currentPrice);

    const marketValue =
      currentPrice === null ? null : currentPrice * totalShares;

    const profitLoss =
      marketValue === null ? null : marketValue - totalCost;

    const profitLossRate =
      profitLoss === null || totalCost === 0 ? null : (profitLoss / totalCost) * 100;

    const activeAlerts = stock.alerts.filter((alert) => alert.isActive);

    const triggeredAlerts =
      currentPrice === null
        ? []
        : activeAlerts.filter((alert) => {
            const targetPrice = Number(alert.targetPrice);

            if (alert.direction === "ABOVE") {
              return currentPrice >= targetPrice;
            }

            if (alert.direction === "BELOW") {
              return currentPrice <= targetPrice;
            }

            return false;
          });

    return {
      id: stock.id,
      symbol: stock.symbol,
      name: stock.name,
      market: stock.market,
      currentPrice,
      priceUpdatedAt: stock.priceUpdatedAt?.toISOString() ?? null,
      totalShares,
      totalCost,
      averageBuyPrice,
      marketValue,
      profitLoss,
      profitLossRate,
      activeAlerts: activeAlerts.map((alert) => ({
        id: alert.id,
        direction: alert.direction,
        targetPrice: Number(alert.targetPrice),
      })),
      triggeredAlerts: triggeredAlerts.map((alert) => ({
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

  const prompt = `
あなたは株式ポートフォリオ管理アプリのAIサマリー担当です。
以下のポートフォリオデータをもとに、日本語で全体状況をわかりやすく要約してください。
要約する際に、

重要:
- 投資助言や売買推奨はしないでください。「買うべき」「売るべき」「必ず上がる」などの断定は避けてください。
- 銘柄一覧や市場構成の紹介ではなく、現在見るべき状態にフォーカスしてください。
- 1文目では、損益、アラート接近、価格未取得、保有ゼロ銘柄などのうち、最も重要な点から述べてください。
- 重要度の高い順に、損益状況、アラート状況、確認すべき点を整理してください。
- アラートの発動に近い銘柄があれば、必ず簡潔に触れてください。
- 保有株数が0の銘柄は原則詳しく説明しないでください。ただし管理上の注意点がある場合だけ簡潔に触れてください。
- 日本株と米国株は通貨が違うため、JPとUSの金額を直接合算しないでください。
- 4〜6文程度で簡潔に書き、最後に「これは投資助言ではなく、保有状況の整理です。」という趣旨を自然に含めてください。

市場別集計:
${JSON.stringify(marketSummaries, null, 2)}

銘柄別データ:
${JSON.stringify(stockSummaries, null, 2)}
`;

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.json({
      summary: response.text,
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

stocksRouter.get("/alerts/ai-summary", async (req, res) => {
  const rawThresholdRate = req.query.thresholdRate;

  const thresholdRate =
    typeof rawThresholdRate === "string" ? Number(rawThresholdRate) : 5;

  if (!Number.isFinite(thresholdRate) || thresholdRate < 0) {
    return res.status(400).json({
      error: "thresholdRate must be a non-negative number",
    });
  }

  const stocks = await prisma.stock.findMany({
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

  const alertAnalyses = stocks.flatMap((stock) => {
    if (stock.currentPrice === null) {
      return [];
    }

    const currentPrice = Number(stock.currentPrice);

    if (currentPrice <= 0) {
      return [];
    }

    return stock.alerts
      .filter((alert) => alert.isActive)
      .map((alert) => {
        const targetPrice = Number(alert.targetPrice);

        const isTriggered =
          alert.direction === "ABOVE"
            ? currentPrice >= targetPrice
            : currentPrice <= targetPrice;

        const priceDiffToTrigger = isTriggered
          ? 0
          : alert.direction === "ABOVE"
            ? targetPrice - currentPrice
            : currentPrice - targetPrice;

        const distanceRateToTrigger = isTriggered
          ? 0
          : (priceDiffToTrigger / currentPrice) * 100;

        const status =
          isTriggered
            ? "TRIGGERED"
            : distanceRateToTrigger <= thresholdRate
              ? "NEAR"
              : "NORMAL";

        return {
          stockId: stock.id,
          symbol: stock.symbol,
          name: stock.name,
          market: stock.market,
          currentPrice,
          alertId: alert.id,
          direction: alert.direction,
          targetPrice,
          isTriggered,
          priceDiffToTrigger,
          distanceRateToTrigger,
          status,
        };
      });
  });

  const sortedAlertAnalyses = alertAnalyses.sort((a, b) => {
    if (a.isTriggered !== b.isTriggered) {
      return a.isTriggered ? -1 : 1;
    }

    return a.distanceRateToTrigger - b.distanceRateToTrigger;
  });

  const importantAlerts = sortedAlertAnalyses
    .filter((alert) => {
      return alert.isTriggered || alert.distanceRateToTrigger <= thresholdRate;
    })
    .slice(0, 10);

  const closestAlerts = sortedAlertAnalyses.slice(0, 10);

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
${JSON.stringify(importantAlerts, null, 2)}

近い順のアラート:
${JSON.stringify(closestAlerts, null, 2)}
`;

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.json({
      summary: response.text,
      thresholdRate,
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

stocksRouter.get("/:id/ai-summary",async (req,res) => {
  const stockId = Number(req.params.id);

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({error:"invalid stock id"});
  }

  const stock = await prisma.stock.findUnique({
    where: {
      id: stockId,
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

  const totalShares = stock.lots.reduce((sum, lot) => {
    return sum + Number(lot.quantity);
  }, 0);

  const totalCost = stock.lots.reduce((sum, lot) => {
    return sum + Number(lot.quantity) * Number(lot.buyPrice);
  }, 0);

  const averageBuyPrice = totalShares === 0 ? null : totalCost / totalShares;

  const currentPrice =
    stock.currentPrice === null ? null : Number(stock.currentPrice);

  const marketValue =
    currentPrice === null ? null : currentPrice * totalShares;

  const profitLoss =
    marketValue === null ? null : marketValue - totalCost;

  const profitLossRate =
    profitLoss === null || totalCost === 0 ? null : (profitLoss / totalCost) * 100;

  const activeAlerts = stock.alerts.filter((alert) => alert.isActive);

  const triggeredAlerts =
    currentPrice === null
      ? []
      : activeAlerts.filter((alert) => {
          const targetPrice = Number(alert.targetPrice);

          if (alert.direction === "ABOVE") {
            return currentPrice >= targetPrice;
          }

          if (alert.direction === "BELOW") {
            return currentPrice <= targetPrice;
          }

          return false;
      });

  const prompt = `
  あなたは株式ポートフォリオ管理アプリのAIサマリー担当です。
  以下のデータをもとに、日本語で保有状況をわかりやすく要約してください。

  重要:
  - 投資助言や売買推奨はしないでください。
  - 「買うべき」「売るべき」「必ず上がる」などの断定は避けてください。
  - 中長期保有の管理目線で、現在の状態、損益、アラート状況を整理してください。
  - 3〜5文程度で簡潔に書いてください。

  銘柄データ:
  - ID: ${stock.id}
  - シンボル: ${stock.symbol}
  - 銘柄名: ${stock.name ?? "未設定"}
  - 市場: ${stock.market}
  - 現在価格: ${currentPrice ?? "未取得"}
  - 価格更新日時: ${stock.priceUpdatedAt?.toISOString() ?? "未取得"}

  保有状況:
  - 保有株数: ${totalShares}
  - 取得総額: ${totalCost}
  - 平均取得単価: ${averageBuyPrice ?? "未計算"}
  - 現在評価額: ${marketValue ?? "未計算"}
  - 含み損益: ${profitLoss ?? "未計算"}
  - 損益率: ${profitLossRate ?? "未計算"}%

  アラート:
  - 設定中アラート数: ${activeAlerts.length}
  - 発火中アラート数: ${triggeredAlerts.length}
  - アラート一覧: ${activeAlerts
    .map((alert) => {
      return `${alert.direction} ${Number(alert.targetPrice)}`;
    })
    .join(", ") || "なし"}
  `;

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.json({
      stockId: stock.id,
      summary: response.text,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "failed to generate AI summary",
    });
  }



});

stocksRouter.get("/:id/summary", async (req, res) => {
  const stockId = Number(req.params.id);

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  const stock = await prisma.stock.findUnique({
    where: {
      id: stockId,
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

  const totalShares = stock.lots.reduce((sum, lot) => {
    return sum + lot.quantity;
  }, 0);

  const totalCost = stock.lots.reduce((sum, lot) => {
    return sum + lot.quantity * Number(lot.buyPrice);
  }, 0);

  const averageBuyPrice =
    totalShares === 0 ? null : totalCost / totalShares;

  const currentPrice =
    stock.currentPrice === null ? null : Number(stock.currentPrice);

  const marketValue =
    currentPrice === null ? null : totalShares * currentPrice;

  const unrealizedProfit =
    marketValue === null ? null : marketValue - totalCost;

  const unrealizedProfitRate =
    unrealizedProfit === null || totalCost === 0
      ? null
      : unrealizedProfit / totalCost;

  const triggeredAlerts =
    currentPrice === null
      ? []
      : stock.alerts.filter((alert) => {
          if (!alert.isActive) {
            return false;
          }
          const targetPrice = Number(alert.targetPrice);
          if (alert.direction === "ABOVE") {
            return currentPrice >= targetPrice;
          }
          if (alert.direction === "BELOW") {
            return currentPrice <= targetPrice;
          }
          return false;
        });

  return res.json({
    stock: {
      id: stock.id,
      symbol: stock.symbol,
      name: stock.name,
      market: stock.market,
      currentPrice: stock.currentPrice,
      priceUpdatedAt: stock.priceUpdatedAt,
    },
    position: {
      totalShares,
      totalCost,
      averageBuyPrice,
      marketValue,
      unrealizedProfit,
      unrealizedProfitRate,
    },
    alerts: {
      all: stock.alerts,
      triggered: triggeredAlerts,
    },
  });
});

stocksRouter.post("/:id/alerts", async (req, res) => {
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

  const stock = await prisma.stock.findUnique({
    where: {
      id: stockId,
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
  const stockId = Number(req.params.id);
  const { text } = req.body;

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  if (typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "text is required" });
  }

  const stock = await prisma.stock.findUnique({
    where: {
      id: stockId,
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
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const parsed = parseJsonFromGeminiText(response.text ?? "");

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

stocksRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (Number.isNaN(id)) {
    return res.status(400).json({ error: "invalid stock id" });
  }

  const stock = await prisma.stock.findUnique({
    where: {
      id,
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
    totalQuantity,
    totalCost,
    averageBuyPrice,
  });
});

stocksRouter.patch("/:id/price",async (req,res) => {
  const stockId = Number(req.params.id);
  const { currentPrice } = req.body;

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({error:"invalid stock id"});
  }

  if (typeof currentPrice !== "number" || currentPrice <= 0) {
    return res.status(400).json({error:"currentPrice must be positive number"});
  }

  try {
    const stock = await prisma.stock.update({
      where: {
        id: stockId,
      },
      data: {
        currentPrice,
      },
    });
    return res.json(stock);
  } catch (error) {
    return res.status(404).json({error:"stock not found"});
  }
});

stocksRouter.get("/:stockId/alerts", async (req,res) => {
  const stockId = Number(req.params.stockId);

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({error:"invalid stockId"});
  }

  const stock = await prisma.stock.findUnique({
    where: {id:stockId},
  });

  if (!stock) {
    return res.status(404).json({error:"status not found"});
  }

  const alerts = await prisma.stockAlert.findMany({
    where: { stockId },
    orderBy: {
      id: "asc",
    },
  });
  return res.json(alerts);
});

stocksRouter.post("/:stockId/alerts",async (req,res) => {
  const stockId = Number(req.params.stockId);
  const {direction, targetPrice} = req.body;

  if (!Number.isInteger(stockId)) {
    return res.status(400).json({error:"invalid stockId"});
  }

  if (direction !== "ABOVE" && direction !== "BELOW") {
    return res.status(400).json({error:"direction must be ABOVE or BELOW"});
  }

  const priceNumber = Number(targetPrice);

  if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
    return res.status(400).json({error:"targetPrice must be positive number"});
  }

  const stock = await prisma.stock.findUnique({
    where: {id:stockId},
  });

  if (!stock) {
    return res.status(404).json({error:"stock not found"});
  }

  const alert = await prisma.stockAlert.create({
    data: {
      stockId,
      direction,
      targetPrice: priceNumber,
    },
  });

  return res.status(201).json(alert);
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