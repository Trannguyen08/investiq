export function formatDecimal(value: string, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits }).format(Number(value));
}

export function formatCompact(value: string) {
  return new Intl.NumberFormat("vi-VN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

export function formatMoney(value: string) {
  return `${formatCompact(value)} ₫`;
}

export function formatPercent(value: string) {
  const amount = Number(value);
  return `${amount > 0 ? "+" : ""}${formatDecimal(value)}%`;
}

export function formatChange(value: string) {
  const amount = Number(value);
  return `${amount > 0 ? "+" : ""}${formatDecimal(value)}`;
}

export function changeTone(value: string) {
  const amount = Number(value);
  if (amount > 0) return "positive";
  if (amount < 0) return "negative";
  return "neutral";
}

export function formatMarketTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function formatEventDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

