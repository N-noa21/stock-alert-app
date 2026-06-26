export type StockLot = {
  id: number;
  stockId: number;
  quantity: number;
  buyPrice: string;
  createdAt: string;
  updatedAt: string;
};

export type StockAlert = {
  id: number;
  stockId: number;
  direction: "ABOVE" | "BELOW";
  targetPrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StockSummary = {
  stock: Stock;
  lots: StockLot[];
  alerts: StockAlert[];
  triggeredAlerts: StockAlert[];

  totalShares: number;
  totalCost: number;
  averageBuyPrice: number | null;
  currentValue: number | null;
  profitLoss: number | null;
  profitLossRate: number | null;
};

export type Market = "JP" | "US";

export type Stock = {
  id: number;
  symbol: string;
  name: string | null;
  market: Market;
  currentPrice: string | null;
  priceUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};