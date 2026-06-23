type AlertLike = {
  id: number;
  direction: "ABOVE" | "BELOW";
  targetPrice: unknown;
  isActive: boolean;
};

type StockWithAlertsLike = {
  id: number;
  symbol: string;
  name: string | null;
  market: "JP" | "US";
  currentPrice: unknown | null;
  alerts: AlertLike[];
};

export type AlertStatus = "TRIGGERED" | "NEAR" | "NORMAL";

export type AlertAnalysis = {
  stockId: number;
  symbol: string;
  name: string | null;
  market: "JP" | "US";
  currentPrice: number;
  alertId: number;
  direction: "ABOVE" | "BELOW";
  targetPrice: number;
  isTriggered: boolean;
  priceDiffToTrigger: number;
  distanceRateToTrigger: number;
  status: AlertStatus;
};

export function analyzeStockAlerts(
  stocks: StockWithAlertsLike[],
  thresholdRate: number,
) {
  const alertAnalyses: AlertAnalysis[] = stocks.flatMap((stock) => {
    if (stock.currentPrice === null) {
      return [];
    }

    const currentPrice = Number(stock.currentPrice);

    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
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

        const status: AlertStatus = isTriggered
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

  const sortedAlertAnalyses = [...alertAnalyses].sort((a, b) => {
    if (a.isTriggered !== b.isTriggered) {
      return a.isTriggered ? -1 : 1;
    }

    return a.distanceRateToTrigger - b.distanceRateToTrigger;
  });

  const importantAlerts = sortedAlertAnalyses
    .filter((alert) => {
      return alert.isTriggered || alert.distanceRateToTrigger <= thresholdRate;
    })
    .slice(0, 5);

  const closestAlerts = sortedAlertAnalyses.slice(0, 5);

  return {
    alertAnalyses,
    sortedAlertAnalyses,
    importantAlerts,
    closestAlerts,
  };
}