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

export function priceTone(
  value: string,
  referencePrice: string,
  ceilingPrice: string,
  floorPrice: string,
) {
  const amount = Number(value);
  const reference = Number(referencePrice);
  if (!Number.isFinite(amount) || !Number.isFinite(reference)) return "price-neutral";
  if (amount === Number(ceilingPrice)) return "price-ceiling";
  if (amount === Number(floorPrice)) return "price-floor";
  if (amount > reference) return "price-up";
  if (amount < reference) return "price-down";
  return "price-reference";
}

export function formatRatioPair(
  pe: string | null | undefined,
  pb: string | null | undefined,
  loading = false,
) {
  if (loading) return "Đang tải…";
  const ratio = (value: string | null | undefined) => {
    if (value === null || value === undefined) return "N/A";
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "N/A";
    return amount.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  };
  return `${ratio(pe)} / ${ratio(pb)}`;
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

const VIETNAMESE_WEEKDAYS = ["CN", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export function formatEventDate(value: string) {
  const date = new Date(value);
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const vnDate = new Date(utc + 7 * 3600000);
  const day = String(vnDate.getDate()).padStart(2, "0");
  const month = String(vnDate.getMonth() + 1).padStart(2, "0");
  const year = vnDate.getFullYear();
  const weekday = VIETNAMESE_WEEKDAYS[vnDate.getDay()];
  return `${weekday}, ${day}/${month}/${year}`;
}

