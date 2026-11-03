import type { PaperHolding, PaperTrade } from "@/types/portfolio";

export type DecimalFraction = { numerator: bigint; denominator: bigint };

export const BIGINT_ZERO = BigInt(0);
export const BIGINT_ONE = BigInt(1);
export const BIGINT_TWO = BigInt(2);
export const BIGINT_TEN = BigInt(10);
export const BIGINT_HUNDRED = BigInt(100);
export const BIGINT_TEN_THOUSAND = BigInt(10_000);

export function decimalFraction(value: string): DecimalFraction {
  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return { numerator: BIGINT_ZERO, denominator: BIGINT_ONE };
  const fraction = match[3] ?? "";
  const denominator = BIGINT_TEN ** BigInt(fraction.length);
  const magnitude = BigInt(`${match[2]}${fraction}`);
  return { numerator: match[1] ? -magnitude : magnitude, denominator };
}

export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BIGINT_ZERO) return BIGINT_ZERO;
  const sign = numerator < BIGINT_ZERO ? -BIGINT_ONE : BIGINT_ONE;
  const magnitude = numerator < BIGINT_ZERO ? -numerator : numerator;
  return sign * ((magnitude + denominator / BIGINT_TWO) / denominator);
}

export function roundVnd(value: string): bigint {
  const fraction = decimalFraction(value);
  return roundHalfUp(fraction.numerator, fraction.denominator);
}

export function multiplyVnd(value: string, quantity: number): bigint {
  const fraction = decimalFraction(value);
  return roundHalfUp(fraction.numerator * BigInt(quantity), fraction.denominator);
}

export function rateAmount(amount: bigint, rate: string): bigint {
  const fraction = decimalFraction(rate);
  return roundHalfUp(amount * fraction.numerator, fraction.denominator);
}

export function percentOf(value: bigint, basis: bigint): string {
  if (basis <= BIGINT_ZERO) return "—";
  const hundredths = roundHalfUp(value * BIGINT_TEN_THOUSAND, basis);
  const sign = hundredths > BIGINT_ZERO ? "+" : hundredths < BIGINT_ZERO ? "−" : "";
  const magnitude = hundredths < BIGINT_ZERO ? -hundredths : hundredths;
  return `${sign}${magnitude / BIGINT_HUNDRED},${String(magnitude % BIGINT_HUNDRED).padStart(2, "0")}%`;
}

export function projectedHolding(
  holding: PaperHolding,
  quantity: number,
  brokerFeeRate: string,
  sellTaxRate: string
) {
  if (!holding.current_price || quantity <= 0 || holding.quantity <= 0) return null;
  const gross = multiplyVnd(holding.current_price, quantity);
  const fee = rateAmount(gross, brokerFeeRate);
  const tax = rateAmount(gross, sellTaxRate);
  const basis = roundHalfUp(
    roundVnd(holding.total_cost_basis) * BigInt(quantity),
    BigInt(holding.quantity)
  );
  const netProceeds = gross - fee - tax;
  const pnl = netProceeds - basis;
  return { gross, fee, tax, basis, netProceeds, pnl, percent: percentOf(pnl, basis) };
}

export function realizedTrade(trade: PaperTrade) {
  const pnl = roundVnd(trade.realized_pnl ?? "0");
  const netProceeds = roundVnd(trade.cash_effect);
  const basis = netProceeds - pnl;
  const averageCost =
    trade.quantity > 0
      ? roundHalfUp(basis, BigInt(trade.quantity))
      : BIGINT_ZERO;
  return { pnl, basis, averageCost, percent: percentOf(pnl, basis) };
}
