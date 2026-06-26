"use client";

import Link from "next/link";
import {  useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Stock, StockAlert, StockLot, StockSummary } from "@/types/stock";
import { Header } from "@/components/Header";
type AlertDirection = "ABOVE" | "BELOW";
import { formatNumber, formatPercent, profitClassName } from "@/lib/format";

type RawStockSummary = {
  stock?: Stock & {
    tradingViewUrl?: string;
  };
  position?: {
    totalShares?: number;
    totalCost?: number;
    averageBuyPrice?: number | null;
    marketValue?: number | null;
    unrealizedProfit?: number | null;
    unrealizedProfitRate?: number | null;
  };
  alerts?: {
    all?: StockAlert[];
    active?: StockAlert[];
    triggered?: StockAlert[];
  };
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


function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function StockDetailPage() {
  const params = useParams<{ id: string }>();
  const stockId = params.id;

  const [summary, setSummary] = useState<StockSummary | null>(null);

  const [quantity, setQuantity] = useState("");
  const [buyPrice, setBuyPrice] = useState("");

  const [direction, setDirection] = useState<AlertDirection>("ABOVE");
  const [targetPrice, setTargetPrice] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isRefreshingPrice, setIsRefreshingPrice] = useState(false);

  const router = useRouter();

  async function refreshPrice() {
    setIsRefreshingPrice(true);
  
    try {
      await apiFetch(`/stocks/${stockId}/refresh-price`, {
        method: "POST",
      });
    } catch (err) {
      console.warn("価格更新に失敗しました", err);
    } finally {
      setIsRefreshingPrice(false);
    }
  }

async function fetchSummary() {
  setError(null);
  setIsLoading(true);

  try {
    const data = await apiFetch<RawStockSummary>(`/stocks/${stockId}/summary`);

    if (!data.stock) {
      throw new Error("stock が取得できませんでした");
    }

    const lots = await apiFetch<StockLot[]>(`/stocks/${stockId}/lots`);

    const normalizedSummary: StockSummary = {
      stock: data.stock,

      lots,

      alerts: asArray<StockAlert>(data.alerts?.all),
      triggeredAlerts: asArray<StockAlert>(data.alerts?.triggered),

      totalShares: data.position?.totalShares ?? 0,
      totalCost: data.position?.totalCost ?? 0,
      averageBuyPrice: data.position?.averageBuyPrice ?? null,
      currentValue: data.position?.marketValue ?? null,
      profitLoss: data.position?.unrealizedProfit ?? null,
      profitLossRate: data.position?.unrealizedProfitRate ?? null,
    };

    setSummary(normalizedSummary);
} catch (err) {
  if (err instanceof ApiError && err.status === 401) {
    router.push("/login");
    return;
  }
  setError(err instanceof Error ? err.message : "詳細の取得に失敗しました");
  } finally {
    setIsLoading(false);
  }
}
  useEffect(() => {
    async function loadDetail() {
      await refreshPrice();
      await fetchSummary();
    }
  
    loadDetail();
  }, [stockId]);
  
  async function handleCreateLot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    try {
      await apiFetch(`/stocks/${stockId}/lots`, {
        method: "POST",
        body: JSON.stringify({
          quantity: Number(quantity),
          buyPrice: Number(buyPrice),
        }),
      });

      setQuantity("");
      setBuyPrice("");
      await fetchSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ロット追加に失敗しました");
    }
  }

  async function handleDeleteLot(lotId: number) {
    setError(null);

    try {
      await apiFetch(`/stocks/${stockId}/lots/${lotId}`, {
        method: "DELETE",
      });

      await fetchSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ロット削除に失敗しました");
    }
  }

  async function handleCreateAlert(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    try {
      await apiFetch<StockAlert>(`/stocks/${stockId}/alerts`, {
        method: "POST",
        body: JSON.stringify({
          direction,
          targetPrice: Number(targetPrice),
        }),
      });

      setDirection("ABOVE");
      setTargetPrice("");
      await fetchSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アラート追加に失敗しました");
    }
  }


  
  async function handleDeleteAlert(alertId: number) {
    setError(null);

    try {
      await apiFetch(`/stocks/${stockId}/alerts/${alertId}`, {
        method: "DELETE",
      });

      await fetchSummary();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }

      setError(err instanceof Error ? err.message : "アラート削除に失敗しました");
    }
  }

  async function handleDeleteStock() {
    const ok = window.confirm("この銘柄を削除しますか？ロットとアラートも削除されます。");

    if (!ok) return;

    setError(null);

    try {
      await apiFetch(`/stocks/${stockId}`, {
        method: "DELETE",
      });

      router.push("/stocks");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push("/login");
        return;
      }

      setError(err instanceof Error ? err.message : "銘柄削除に失敗しました");
    }
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p>読み込み中...</p>
      </main>
    );
  }

  if (!summary) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p>データがありません。</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </main>
    );
  }

  const { stock, lots, alerts, triggeredAlerts } = summary;

  return (
    <>
    <Header/>
    <main className="mx-auto max-w-4xl p-8">

      <section className="mb-8 rounded border p-5">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {stock.symbol}{" "}
              <span className="text-base font-normal text-gray-500">
                {stock.market}
              </span>
            </h1>
            <p className="text-gray-600">{stock.name ?? "名称未設定"}</p>
          </div>

        <div className="text-right">
          <p className="text-sm text-gray-500">現在価格</p>
          <p className="text-xl font-bold">
            {isRefreshingPrice ? "更新中..." : stock.currentPrice ?? "未取得"}
          </p>
        </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded bg-gray-50 p-4">
            <p className="text-sm text-gray-500">保有株数</p>
            <p className="text-xl font-bold">{formatNumber(summary.totalShares)}</p>
          </div>

          <div className="rounded bg-gray-50 p-4">
            <p className="text-sm text-gray-500">平均取得単価</p>
            <p className="text-xl font-bold">
              {formatNumber(summary.averageBuyPrice)}
            </p>
          </div>

          <div className="rounded bg-gray-50 p-4">
            <p className="text-sm text-gray-500">評価損益</p>
            <p className={`text-xl font-bold ${profitClassName(summary.profitLoss)}`}>
              {formatNumber(summary.profitLoss)}
            </p>
          </div>
          <div className="rounded bg-gray-50 p-4">
            <p className="text-sm text-gray-500">損益率</p>
            <p className={`text-xl font-bold ${profitClassName(summary.profitLossRate)}`}>
              {formatPercent(summary.profitLossRate)}
            </p>
          </div>
        </div>
      </section>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {triggeredAlerts.length > 0 && (
        <section className="mb-8 rounded border border-red-300 bg-red-50 p-5">
          <h2 className="mb-3 text-lg font-bold text-red-700">
            発火中のアラート
          </h2>

          <div className="space-y-2">
            {triggeredAlerts.map((alert) => (
              <div key={alert.id} className="text-sm">
                {alert.direction === "ABOVE" ? "以上" : "以下"}{" "}
                {alert.targetPrice}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8 rounded border p-5">
        <h2 className="mb-4 text-lg font-bold">保有ロット追加</h2>

        <form onSubmit={handleCreateLot} className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">株数</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100"
              type="number"
              step="0.0001"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">購入単価</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="3000"
              type="number"
              step="0.0001"
            />
          </div>

          <div className="flex items-end">
            <button className="w-full rounded bg-black px-4 py-2 text-white">
              追加
            </button>
          </div>
        </form>
      </section>

      <section className="mb-8 rounded border p-5">
        <h2 className="mb-4 text-lg font-bold">保有ロット一覧</h2>

        {lots.length === 0 ? (
          <p className="text-sm text-gray-600">まだロットがありません。</p>
        ) : (
          <div className="space-y-3">
            {lots.map((lot) => (
              <div
                key={lot.id}
                className="flex items-center justify-between rounded bg-gray-50 p-4"
              >
                <div>
                  <p className="font-bold">{lot.quantity} 株</p>
                  <p className="text-sm text-gray-600">
                    購入単価: {lot.buyPrice}
                  </p>
                </div>

                <button
                  onClick={() => handleDeleteLot(lot.id)}
                  className="rounded border px-3 py-1 text-sm text-red-600"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-8 rounded border p-5">
        <h2 className="mb-4 text-lg font-bold">アラート追加</h2>

        <form onSubmit={handleCreateAlert} className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">条件</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={direction}
              onChange={(e) => setDirection(e.target.value as AlertDirection)}
            >
              <option value="ABOVE">指定価格以上</option>
              <option value="BELOW">指定価格以下</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">目標価格</label>
            <input
              className="w-full rounded border px-3 py-2"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              placeholder="3500"
              type="number"
              step="0.0001"
            />
          </div>

          <div className="flex items-end">
            <button className="w-full rounded bg-black px-4 py-2 text-white">
              追加
            </button>
          </div>
        </form>
      </section>

      <section className="rounded border p-5">
        <h2 className="mb-4 text-lg font-bold">アラート一覧</h2>

        {alerts.length === 0 ? (
          <p className="text-sm text-gray-600">まだアラートがありません。</p>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded bg-gray-50 p-4"
              >
                <div>
                  <p className="font-bold">
                    {alert.direction === "ABOVE" ? "指定価格以上" : "指定価格以下"}:{" "}
                    {alert.targetPrice}
                  </p>
                  <p className="text-sm text-gray-600">
                    {alert.isActive ? "有効" : "無効"}
                  </p>
                </div>
            
                <button
                  onClick={() => handleDeleteAlert(alert.id)}
                  className="rounded border px-3 py-1 text-sm text-red-600"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 rounded border border-red-300 p-5">
        <h2 className="mb-2 text-lg font-bold text-red-700">危険な操作</h2>
        <p className="mb-4 text-sm text-gray-600">
          この銘柄を削除すると、関連する保有ロットとアラートも削除されます。
        </p>

        <button
          onClick={handleDeleteStock}
          className="rounded bg-red-600 px-4 py-2 text-white"
        >
          この銘柄を削除
        </button>
      </section>
    </main>
    </>
  );
}