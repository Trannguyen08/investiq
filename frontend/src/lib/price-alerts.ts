export type PriceAlertDirection = "above" | "below";

export type PriceAlert = {
  id: string;
  symbol: string;
  name: string;
  direction: PriceAlertDirection;
  targetPrice: number;
  note?: string;
  createdAt: string;
};

export type EvaluatedPriceAlert = PriceAlert & {
  currentPrice: number | null;
  triggered: boolean;
};

const ALERTS_STORAGE_KEY = "investiq.market.price_alerts.v1";
const MAX_ALERTS = 50;

export function loadPriceAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is PriceAlert =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as PriceAlert).id === "string" &&
        typeof (item as PriceAlert).symbol === "string" &&
        typeof (item as PriceAlert).targetPrice === "number" &&
        ((item as PriceAlert).direction === "above" || (item as PriceAlert).direction === "below"),
    );
  } catch {
    return [];
  }
}

export function savePriceAlerts(alerts: PriceAlert[]): PriceAlert[] {
  const bounded = alerts.slice(0, MAX_ALERTS);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(bounded));
      window.dispatchEvent(new CustomEvent("investiq:price-alerts-updated"));
    } catch {
      // Ignore storage errors
    }
  }
  return bounded;
}

export function addPriceAlert(
  input: Omit<PriceAlert, "id" | "createdAt">,
): PriceAlert[] {
  const normalizedSymbol = input.symbol.trim().toUpperCase();
  if (!normalizedSymbol || !Number.isFinite(input.targetPrice) || input.targetPrice <= 0) {
    return loadPriceAlerts();
  }
  const existing = loadPriceAlerts();
  const nextAlert: PriceAlert = {
    id: `${normalizedSymbol}-${input.direction}-${Math.round(input.targetPrice)}-${Date.now()}`,
    symbol: normalizedSymbol,
    name: input.name.trim() || normalizedSymbol,
    direction: input.direction,
    targetPrice: Math.round(input.targetPrice),
    note: input.note?.trim().slice(0, 120) || undefined,
    createdAt: new Date().toISOString(),
  };
  return savePriceAlerts([nextAlert, ...existing]);
}

export function removePriceAlert(id: string): PriceAlert[] {
  const next = loadPriceAlerts().filter((item) => item.id !== id);
  return savePriceAlerts(next);
}

export function isAlertTriggered(alert: PriceAlert, currentPrice: number | null): boolean {
  if (currentPrice === null || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return false;
  }
  return alert.direction === "above"
    ? currentPrice >= alert.targetPrice
    : currentPrice <= alert.targetPrice;
}

export function evaluatePriceAlerts(
  alerts: PriceAlert[],
  pricesBySymbol: Record<string, number>,
): EvaluatedPriceAlert[] {
  return alerts.map((alert) => {
    const raw = pricesBySymbol[alert.symbol.toUpperCase()];
    const currentPrice = typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : null;
    return {
      ...alert,
      currentPrice,
      triggered: isAlertTriggered(alert, currentPrice),
    };
  });
}
