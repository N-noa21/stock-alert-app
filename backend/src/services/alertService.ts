import { prisma } from "../lib/prisma";

function isAlertTriggered(params: {
  currentPrice: number;
  direction: "ABOVE" | "BELOW";
  targetPrice: number;
}): boolean {
  if (params.direction === "ABOVE") {
    return params.currentPrice >= params.targetPrice;
  }

  return params.currentPrice <= params.targetPrice;
}

export async function syncTriggeredAlertsForStock(stockId: number) {
  const stock = await prisma.stock.findUnique({
    where: {
      id: stockId,
    },
    include: {
      alerts: true,
    },
  });

  if (!stock || stock.currentPrice === null) {
    return;
  }

  const currentPrice = Number(stock.currentPrice);
  const now = new Date();

  const targetAlerts = stock.alerts.filter((alert) => {
    if (!alert.isActive) return false;
    if (alert.triggeredAt !== null) return false;

    return isAlertTriggered({
      currentPrice,
      direction: alert.direction,
      targetPrice: Number(alert.targetPrice),
    });
  });

  await Promise.all(
    targetAlerts.map((alert) =>
      prisma.stockAlert.update({
        where: {
          id: alert.id,
        },
        data: {
          triggeredAt: now,
        },
      })
    )
  );
}