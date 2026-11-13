"""SQL repository for persisting and retrieving crawled financial statements in PostgreSQL."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.infrastructure.db.session import get_pool

logger = logging.getLogger(__name__)


class SqlFinancialStatementsRepository:
    """Repository handling persistent storage of financial statements in database."""

    def upsert(self, symbol: str, period_type: str, data: dict[str, Any]) -> bool:
        """Upsert financial statement data for a given symbol and period."""
        norm_sym = symbol.upper()
        norm_period = "year" if period_type.lower() == "year" else "quarter"
        try:
            pool = get_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO financial_statements (
                        symbol,
                        period_type,
                        periods,
                        charts,
                        income_statement,
                        balance_sheet,
                        cash_flow,
                        source,
                        updated_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (symbol, period_type)
                    DO UPDATE SET
                        periods = EXCLUDED.periods,
                        charts = EXCLUDED.charts,
                        income_statement = EXCLUDED.income_statement,
                        balance_sheet = EXCLUDED.balance_sheet,
                        cash_flow = EXCLUDED.cash_flow,
                        source = EXCLUDED.source,
                        updated_at = NOW();
                    """,
                    (
                        norm_sym,
                        norm_period,
                        json.dumps(data.get("periods", []), ensure_ascii=False),
                        json.dumps(data.get("charts", []), ensure_ascii=False),
                        json.dumps(data.get("income_statement", []), ensure_ascii=False),
                        json.dumps(data.get("balance_sheet", []), ensure_ascii=False),
                        json.dumps(data.get("cash_flow", []), ensure_ascii=False),
                        str(data.get("source", "Standardized Financial Statement")),
                    ),
                )
                conn.commit()
            return True
        except Exception as exc:
            logger.warning(
                "sql_financial_statement_upsert_failed",
                extra={"symbol": norm_sym, "period": norm_period, "error": str(exc)},
            )
            return False

    def get(self, symbol: str, period_type: str) -> dict[str, Any] | None:
        """Get financial statement data from database."""
        norm_sym = symbol.upper()
        norm_period = "year" if period_type.lower() == "year" else "quarter"
        try:
            pool = get_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT periods, charts, income_statement, balance_sheet, cash_flow, source, updated_at
                    FROM financial_statements
                    WHERE symbol = %s AND period_type = %s;
                    """,
                    (norm_sym, norm_period),
                )
                row = cur.fetchone()
                if not row:
                    return None

                periods, charts, income, balance, cash, source, updated_at = row
                source_str = str(source or "")
                from app.workers.financial_statements_sync import (
                    resolve_active_financial_source_url,
                )

                default_provider, default_url = resolve_active_financial_source_url(
                    norm_sym, verify=False
                )
                extracted_url = default_url
                if "https://" in source_str:
                    candidate = source_str.split("https://", 1)[1].split()[0].rstrip(").,")
                    if "cafef.vn/hose/" not in candidate.lower():
                        extracted_url = f"https://{candidate}"
                source_provider = (
                    "FireAnt"
                    if "fireant.vn" in extracted_url.lower()
                    else default_provider
                )
                return {
                    "symbol": norm_sym,
                    "period_type": norm_period,
                    "periods": periods
                    if isinstance(periods, list)
                    else json.loads(periods or "[]"),
                    "charts": charts if isinstance(charts, list) else json.loads(charts or "[]"),
                    "income_statement": income
                    if isinstance(income, list)
                    else json.loads(income or "[]"),
                    "balance_sheet": balance
                    if isinstance(balance, list)
                    else json.loads(balance or "[]"),
                    "cash_flow": cash if isinstance(cash, list) else json.loads(cash or "[]"),
                    "source": source_str.split(" | https://", 1)[0],
                    "source_provider": source_provider,
                    "source_url": extracted_url,
                    "updated_at": updated_at.isoformat()
                    if hasattr(updated_at, "isoformat")
                    else None,
                }
        except Exception as exc:
            logger.debug(
                "sql_financial_statement_get_failed",
                extra={"symbol": norm_sym, "period": norm_period, "error": str(exc)},
            )
            return None


_repo_instance: SqlFinancialStatementsRepository | None = None


def get_financial_statements_repository() -> SqlFinancialStatementsRepository:
    """Return singleton SQL financial statements repository."""
    global _repo_instance
    if _repo_instance is None:
        _repo_instance = SqlFinancialStatementsRepository()
    return _repo_instance
