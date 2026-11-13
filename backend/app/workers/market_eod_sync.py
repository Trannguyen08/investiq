"""Periodic EOD synchronization of market indices and notable stock candles to PostgreSQL."""

from __future__ import annotations

import logging
from typing import Any

from app.infrastructure.db.repositories.sql_market_candles_repository import (
    SqlMarketCandlesRepository,
)
from app.workers.celery_app import celery_app

logger = logging.getLogger("investiq.market.eod_sync")

INDEX_SYNC_SPECS: tuple[tuple[str, str, str], ...] = (
    ("VNINDEX", "HOSE", "VN-Index"),
    ("HNXINDEX", "HNX", "HNX-Index"),
    ("UPCOMINDEX", "UPCOM", "UPCoM-Index"),
    ("VN30", "HOSE", "VN30-Index"),
)


def run_market_eod_sync(
    *,
    max_stocks: int = 30,
) -> dict[str, Any]:
    """Sync index (1D/1W/1M) and top liquid stock (1D) candles into PostgreSQL."""
    try:
        from app.api.v1.market_data import get_market_provider

        provider = get_market_provider()
        repo = SqlMarketCandlesRepository()
        indices_synced = 0
        stocks_synced = 0
        candles_upserted = 0

        for symbol, exchange, name in INDEX_SYNC_SPECS:
            for interval_req, interval_db in (("1d", "1D"), ("1w", "1W"), ("1M", "1M")):
                candles = provider.candles(symbol, interval_req)
                if candles:
                    candles_upserted += repo.upsert_candles(
                        provider_slug="vnstock-fhsc",
                        provider_name="Vnstock FHSC",
                        symbol=symbol,
                        exchange=exchange,
                        name=name,
                        instrument_type="index",
                        interval=interval_db,
                        candles=candles,
                    )
            indices_synced += 1

        instruments = sorted(
            provider.instruments(),
            key=lambda item: (item.is_vn30, item.interest_score),
            reverse=True,
        )[: max(0, max_stocks)]
        for inst in instruments:
            candles = provider.candles(inst.symbol, "1d")
            if candles:
                candles_upserted += repo.upsert_candles(
                    provider_slug="vnstock-fhsc",
                    provider_name="Vnstock FHSC",
                    symbol=inst.symbol,
                    exchange=inst.exchange,
                    name=inst.name,
                    instrument_type="stock",
                    interval="1D",
                    candles=candles,
                )
                stocks_synced += 1

        logger.info(
            "market_eod_sync_completed",
            extra={
                "indices_synced": indices_synced,
                "stocks_synced": stocks_synced,
                "candles_upserted": candles_upserted,
            },
        )
        return {
            "status": "success",
            "indices_synced": indices_synced,
            "stocks_synced": stocks_synced,
            "candles_upserted": candles_upserted,
        }
    except Exception as exc:
        logger.error("market_eod_sync_failed: %s", exc, exc_info=True)
        return {"status": "error", "error": str(exc)}


@celery_app.task(name="investiq.market.eod_sync.v1", soft_time_limit=180, time_limit=240)  # type: ignore[untyped-decorator]
def sync_market_eod_candles() -> dict[str, Any]:
    """Celery task to persist index and stock EOD candles in PostgreSQL."""
    return run_market_eod_sync()
