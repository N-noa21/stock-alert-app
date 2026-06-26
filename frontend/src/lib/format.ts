export function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";

  const num = typeof value === "string" ? Number(value) : value;

  if (!Number.isFinite(num)) return "-";

  return num.toLocaleString();
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";

  return `${(value * 100).toFixed(2)}%`;
}

export function profitClassName(value: number | null | undefined) {
  if (value === null || value === undefined) return "text-gray-900";
  if (value > 0) return "text-green-600";
  if (value < 0) return "text-red-600";
  return "text-gray-900";
}