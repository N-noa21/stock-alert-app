export function buildTradingViewUrl(params: {
  symbol: string;
  market: "JP" | "US";
}): string {
  const normalizedSymbol = params.symbol.toUpperCase();

  if (params.market === "JP") {
    return `https://www.tradingview.com/symbols/TSE-${normalizedSymbol}/`;
  }

  return `https://www.tradingview.com/symbols/NASDAQ-${normalizedSymbol}/`;
}