type LotLike = {
  quantity: unknown;
  buyPrice: unknown;
};

type AlertLike = {
  id: number;
  direction: "ABOVE" | "BELOW";
  targetPrice: unknown;
  isActive: boolean;
};

type StockLike = {
  id: number;
  symbol: string;
  name: string | null;
  market: "JP" | "US";
  currentPrice: unknown | null;
  priceUpdatedAt: Date | null;
  lots: LotLike[];
  alerts: AlertLike[];
};

export function calculateStockSummary(stock: StockLike) {
  const totalShares = stock.lots.reduce((sum, lot) => {
    return sum + Number(lot.quantity);
  }, 0);

  const totalCost = stock.lots.reduce((sum, lot) => {
    return sum + Number(lot.quantity) * Number(lot.buyPrice);
  }, 0);

  const averageBuyPrice =
    totalShares === 0 ? null : totalCost / totalShares;

  const currentPrice =
    stock.currentPrice === null ? null : Number(stock.currentPrice);

  const marketValue =
    currentPrice === null ? null : currentPrice * totalShares;

  const unrealizedProfit =
    marketValue === null ? null : marketValue - totalCost;

  const unrealizedProfitRate =
    unrealizedProfit === null || totalCost === 0
      ? null
      : unrealizedProfit / totalCost;

  const activeAlerts = stock.alerts.filter((alert) => {
    return alert.isActive;
  });

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
      active: activeAlerts,
      triggered: triggeredAlerts,
    },
  };
}