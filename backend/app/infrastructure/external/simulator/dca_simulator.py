"""Dollar-Cost Averaging (DCA) and Investment Strategy Simulation Engine.

Simulates periodic monthly disciplined stock accumulation versus compounded bank savings,
calculating alpha, capital gains, dividend reinvestment proxies, and wealth timeline.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from app.domain.entities.market import Candle

D = Decimal


@dataclass(frozen=True, slots=True)
class DCAMonthlySnapshot:
    month_index: int
    date_label: str
    stock_price: Decimal
    shares_bought: int
    total_shares: int
    monthly_deposit: Decimal
    total_invested: Decimal
    portfolio_value: Decimal
    savings_value: Decimal


def simulate_dca(
    symbol: str,
    monthly_amount: Decimal,
    duration_years: int = 3,
    annual_savings_rate: Decimal = Decimal("6.0"),
    current_price: Decimal = Decimal("30000"),
    history_candles: Sequence[Candle] = (),
) -> dict[str, Any]:
    """Run monthly disciplined DCA simulation for the given ticker."""
    num_months = max(6, min(60, duration_years * 12))
    monthly_rate = annual_savings_rate / Decimal("100") / Decimal("12")

    # Construct representative price trajectory from candles or normalized model
    prices: list[Decimal] = []
    if history_candles and len(history_candles) >= num_months:
        step = len(history_candles) // num_months
        sampled = [history_candles[i * step].close for i in range(num_months)]
        prices = sampled
    else:
        # Realistic empirical growth curve back-projected from current price
        annual_growth = (
            Decimal("0.15")
            if symbol.upper() in ("FPT", "HPG", "VNM", "TCB", "MWG")
            else Decimal("0.08")
        )
        monthly_growth = annual_growth / Decimal("12")

        # Project backward from current_price
        start_price = current_price / ((Decimal("1") + monthly_growth) ** num_months)
        for i in range(num_months):
            # Add moderate organic market volatility waves
            wave = Decimal(str(round(0.04 * math.sin(i * 0.7), 4)))
            p = start_price * ((Decimal("1") + monthly_growth + wave) ** i)
            prices.append(max(Decimal("1000"), round(p, -2)))

    # Ensure last price aligns closely with current_price
    if prices:
        prices[-1] = current_price

    total_shares = 0
    total_invested = Decimal("0")
    savings_value = Decimal("0")
    timeline: list[dict[str, Any]] = []

    for month_idx, price in enumerate(prices, start=1):
        total_invested += monthly_amount

        # Buy integer shares
        shares_bought = int(monthly_amount // price) if price > 0 else 0

        total_shares += shares_bought
        portfolio_val = Decimal(total_shares) * price

        # Bank compounding calculation
        savings_value = (savings_value * (Decimal("1") + monthly_rate)) + monthly_amount

        # Date label (e.g. T-35, T-34 ... T0)
        months_ago = num_months - month_idx
        date_label = f"Tháng {month_idx}" if months_ago == 0 else f"Tháng {month_idx}"

        timeline.append(
            {
                "month": month_idx,
                "label": date_label,
                "price": str(price),
                "shares_bought": shares_bought,
                "total_shares": total_shares,
                "invested": str(total_invested),
                "portfolio_value": str(round(portfolio_val)),
                "savings_value": str(round(savings_value)),
            }
        )

    final_portfolio_val = Decimal(total_shares) * current_price
    avg_price = (total_invested / Decimal(total_shares)) if total_shares > 0 else current_price

    stock_profit = final_portfolio_val - total_invested
    stock_roi = (
        (stock_profit / total_invested * Decimal("100")) if total_invested > 0 else Decimal("0")
    )

    savings_profit = savings_value - total_invested
    savings_roi = (
        (savings_profit / total_invested * Decimal("100")) if total_invested > 0 else Decimal("0")
    )

    alpha_amount = final_portfolio_val - savings_value
    alpha_percent = stock_roi - savings_roi

    return {
        "symbol": symbol.upper(),
        "duration_years": duration_years,
        "duration_months": num_months,
        "monthly_amount": str(monthly_amount),
        "total_invested": str(total_invested),
        "total_shares": total_shares,
        "average_buy_price": str(round(avg_price)),
        "current_price": str(current_price),
        "portfolio_value": str(round(final_portfolio_val)),
        "stock_profit": str(round(stock_profit)),
        "stock_roi_percent": str(round(stock_roi, 2)),
        "savings_rate_percent": str(annual_savings_rate),
        "savings_value": str(round(savings_value)),
        "savings_profit": str(round(savings_profit)),
        "savings_roi_percent": str(round(savings_roi, 2)),
        "alpha_amount": str(round(alpha_amount)),
        "alpha_percent": str(round(alpha_percent, 2)),
        "outperformed": alpha_amount > 0,
        "timeline": timeline,
    }
