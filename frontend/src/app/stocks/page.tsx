"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { useRouter } from "next/navigation";
import type { Market, Stock } from "@/types/stock";
import Link from "next/link";
import { Header } from "@/components/Header";
import { formatNumber, formatPercent, profitClassName } from "@/lib/format";


type StockAiSummaryResponse = {
  summary?: string;
  aiSummary?: string;
  cached?: boolean;
  cacheDate?: string;
};

type StockSummaryForPortfolio = {
  position?: {
    totalShares?: number;
    totalCost?: number;
    averageBuyPrice?: number | null;
    marketValue?: number | null;
    unrealizedProfit?: number | null;
    unrealizedProfitRate?: number | null;
  };

  // 念のため、昔のフロント想定にも対応
  totalCost?: number;
  currentValue?: number | null;
  profitLoss?: number | null;
  profitLossRate?: number | null;
};

type PortfolioSummary = {
  stockCount: number;
  totalCost: number;
  marketValue: number;
  unrealizedProfit: number;
  unrealizedProfitRate: number | null;
};


type NotificationTarget = {
  id: number;
  stockId: number;
  direction: "ABOVE" | "BELOW";
  targetPrice: string;
  isActive: boolean;
  triggeredAt: string | null;
  lastNotifiedAt: string | null;
  stock: {
    id: number;
    symbol: string;
    name: string | null;
    market: "JP" | "US";
    currentPrice: string | null;
  };
};

type NotificationTargetsResponse =
  | NotificationTarget[]
  | {
      targets?: NotificationTarget[];
      notificationTargets?: NotificationTarget[];
      alerts?: NotificationTarget[];
    };

function normalizeNotificationTargets(
  data: NotificationTargetsResponse
): NotificationTarget[] {
  if (Array.isArray(data)) return data;

  return data.targets ?? data.notificationTargets ?? data.alerts ?? [];
}

export default function StocksPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [market, setMarket] = useState<Market>("JP");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiCacheDate, setAiCacheDate] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [portfolioSummary, setPortfolioSummary] =
  useState<PortfolioSummary | null>(null);

  const [notificationTargets, setNotificationTargets] = useState<
    NotificationTarget[]
  >([]);
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);
  
  const ENABLE_AI_SUMMARY = false; // AI機能のactivation


  
  async function fetchStocks() {
    setError(null);
    setIsLoading(true);

    try {
      const data = await apiFetch<Stock[]>("/stocks");
      setStocks(data);
      await fetchPortfolioSummary(data);
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    router.push("/login");
    return;
  }
  setError(err instanceof Error ? err.message : "銘柄一覧の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchStocks();
    fetchNotificationTargets();
  }, []);

  async function handleCreateStock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);

    try {
      await apiFetch<Stock>("/stocks", {
        method: "POST",
        body: JSON.stringify({
          symbol,
          name: name.length > 0 ? name : null,
          market,
        }),
      });

      setSymbol("");
      setName("");
      setMarket("JP");

      await fetchStocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "銘柄追加に失敗しました");
    }
  }

  async function handleLogout() {
    try {
      await apiFetch<{ message: string }>("/auth/logout", {
        method: "POST",
      });

      window.location.href = "/login";
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログアウトに失敗しました");
    }
  }

  async function fetchAiSummary(refresh = false) {
    setIsAiLoading(true);

    try {
      const query = refresh ? "?refresh=true" : "";
      const data = await apiFetch<StockAiSummaryResponse>(
        `/stocks/ai-summary${query}`
      );

      console.log("ai summary response", data);

      setAiSummary(data.summary ?? data.aiSummary ?? "AIサマリーを取得できませんでした");
      setAiCacheDate(data.cacheDate ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }

      setAiSummary("AIサマリーの取得に失敗しました");
    } finally {
      setIsAiLoading(false);
    }
  }

  async function fetchPortfolioSummary(stocks: Stock[]) {
    if (stocks.length === 0) {
      setPortfolioSummary({
        stockCount: 0,
        totalCost: 0,
        marketValue: 0,
        unrealizedProfit: 0,
        unrealizedProfitRate: null,
      });
      return;
    }
  
    const summaries = await Promise.all(
      stocks.map((stock) =>
        apiFetch<StockSummaryForPortfolio>(`/stocks/${stock.id}/summary`)
      )
    );
  
    console.log("portfolio summaries", summaries);
  
    const totalCost = summaries.reduce((sum, summary) => {
      return sum + (summary.position?.totalCost ?? summary.totalCost ?? 0);
    }, 0);
  
    const marketValue = summaries.reduce((sum, summary) => {
      return sum + (summary.position?.marketValue ?? summary.currentValue ?? 0);
    }, 0);
  
    const unrealizedProfit = summaries.reduce((sum, summary) => {
      return (
        sum + (summary.position?.unrealizedProfit ?? summary.profitLoss ?? 0)
      );
    }, 0);
  
    const unrealizedProfitRate =
      totalCost > 0 ? unrealizedProfit / totalCost : null;
  
    setPortfolioSummary({
      stockCount: stocks.length,
      totalCost,
      marketValue,
      unrealizedProfit,
      unrealizedProfitRate,
    });
  }

  async function fetchNotificationTargets() {
    setIsNotificationLoading(true);

    try {
      const data = await apiFetch<NotificationTargetsResponse>(
        "/stocks/alerts/notification-targets"
      );

      console.log("notification targets response", data);

      setNotificationTargets(normalizeNotificationTargets(data));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "通知対象アラートの取得に失敗しました"
      );
    } finally {
      setIsNotificationLoading(false);
    }
  }




  return (
    <>
   <Header />
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-bold">登録銘柄</h1>

      {ENABLE_AI_SUMMARY && (
        <section className="mb-8 rounded border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">保有株AIサマリー</h2>
              {aiCacheDate && (
                <p className="text-xs text-gray-500">cacheDate: {aiCacheDate}</p>
              )}
            </div>
            
            <button
              onClick={() => fetchAiSummary(true)}
              disabled={isAiLoading}
              className="rounded border px-3 py-2 text-sm disabled:opacity-50"
            >
              {isAiLoading ? "生成中..." : "再生成"}
            </button>
          </div>
            
          {isAiLoading && !aiSummary ? (
            <p className="text-sm text-gray-600">AIサマリーを取得中...</p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-6">
              {aiSummary ?? "まだAIサマリーがありません。"}
            </p>
          )}
        </section>
      )}

  <section className="mb-8 rounded border p-4">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-lg font-bold">通知対象アラート</h2>
      
      <button
        onClick={fetchNotificationTargets}
        disabled={isNotificationLoading}
        className="rounded border px-3 py-2 text-sm disabled:opacity-50"
      >
        {isNotificationLoading ? "更新中..." : "更新"}
      </button>
    </div>
      
    {isNotificationLoading && notificationTargets.length === 0 ? (
      <p className="text-sm text-gray-600">通知対象を確認中...</p>
    ) : notificationTargets.length === 0 ? (
      <p className="text-sm text-gray-600">
        現在、通知対象のアラートはありません。
      </p>
    ) : (
      <div className="space-y-3">
        {notificationTargets.map((target) => (
          <Link
            key={target.id}
            href={`/stocks/${target.stock.id}`}
            className="block rounded bg-red-50 p-4 hover:bg-red-100"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold">
                  {target.stock.symbol}{" "}
                  <span className="text-sm font-normal text-gray-500">
                    {target.stock.market}
                  </span>
                </p>
        
                <p className="text-sm text-gray-600">
                  {target.stock.name ?? "名称未設定"}
                </p>
        
                <p className="mt-2 text-sm">
                  条件:{" "}
                  {target.direction === "ABOVE"
                    ? "指定価格以上"
                    : "指定価格以下"}{" "}
                  {target.targetPrice}
                </p>
                  
                {target.lastNotifiedAt && (
                  <p className="mt-1 text-xs text-gray-500">
                    最終通知: {target.lastNotifiedAt}
                  </p>
                )}
              </div>
              
              <div className="text-right">
                <p className="text-sm text-gray-500">現在価格</p>
                <p className="font-bold">
                  {target.stock.currentPrice ?? "未取得"}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    )}
  </section>

      <section className="mb-8 rounded border p-4">
        <h2 className="mb-4 text-lg font-bold">ポートフォリオ概要</h2>

        {!portfolioSummary ? (
          <p className="text-sm text-gray-600">集計中...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-5">
            <div className="rounded bg-gray-50 p-4">
              <p className="text-sm text-gray-500">登録銘柄数</p>
              <p className="text-xl font-bold">{portfolioSummary.stockCount}</p>
            </div>
        
            <div className="rounded bg-gray-50 p-4">
              <p className="text-sm text-gray-500">総取得額</p>
              <p className="text-xl font-bold">
                {formatNumber(portfolioSummary.totalCost)}
              </p>
            </div>
        
            <div className="rounded bg-gray-50 p-4">
              <p className="text-sm text-gray-500">総評価額</p>
              <p className="text-xl font-bold">
                {formatNumber(portfolioSummary.marketValue)}
              </p>
            </div>
        
            <div className="rounded bg-gray-50 p-4">
              <p className="text-sm text-gray-500">総損益</p>
              <p
                className={`text-xl font-bold ${profitClassName(
                  portfolioSummary.unrealizedProfit
                )}`}
              >
                {formatNumber(portfolioSummary.unrealizedProfit)}
              </p>
            </div>
        
        <div className="rounded bg-gray-50 p-4">
          <p className="text-sm text-gray-500">損益率</p>
          <p
            className={`text-xl font-bold ${profitClassName(
              portfolioSummary.unrealizedProfitRate
            )}`}
          >
            {formatPercent(portfolioSummary.unrealizedProfitRate)}
          </p>
        </div>
          </div>
        )}
      </section>

      <form onSubmit={handleCreateStock} className="mb-8 rounded border p-4">
        <h2 className="mb-4 text-lg font-bold">銘柄追加</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">symbol</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="7203.T"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">name</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Toyota"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">market</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={market}
              onChange={(e) => setMarket(e.target.value as Market)}
            >
              <option value="JP">JP</option>
              <option value="US">US</option>
            </select>
          </div>
        </div>

        <button className="mt-4 rounded bg-black px-4 py-2 text-white">
          追加
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p>読み込み中...</p>
      ) : stocks.length === 0 ? (
        <p>まだ銘柄がありません。</p>
      ) : (
        <div className="space-y-3">
        {stocks.map((stock) => (
          <Link
            key={stock.id}
            href={`/stocks/${stock.id}`}
            className="block rounded border p-4 hover:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">
                  {stock.symbol}{" "}
                  <span className="text-sm font-normal text-gray-500">
                    {stock.market}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  {stock.name ?? "名称未設定"}
                </p>
              </div>
        
              <div className="text-right">
                <p className="text-sm text-gray-500">現在価格</p>
                <p className="font-bold">{stock.currentPrice ?? "未取得"}</p>
              </div>
            </div>
          </Link>
        ))}
        </div>
      )}
    </main>
    </>
  );
}