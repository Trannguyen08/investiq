"""Continuous corporate events discovery, ingestion, and pruning worker."""

from __future__ import annotations

import logging
from typing import Any

from app.infrastructure.external.crawlers.corporate_events_crawler import (
    get_corporate_events_crawler,
)
from app.workers.celery_app import celery_app

logger = logging.getLogger("investiq.events.worker")


def run_events_ingestion_cycle() -> dict[str, Any]:
    """Execute continuous event crawling, deduplication, and pruning of past events."""
    try:
        from app.api.v1.market_data import get_market_provider, get_market_read_cache

        try:
            provider = get_market_provider()
        except Exception:
            provider = None

        crawler = get_corporate_events_crawler()
        events = crawler.crawl_and_refresh_events(provider=provider)

        # Clear market read cache for events so endpoints immediately serve fresh data
        try:
            cache = get_market_read_cache()
            if hasattr(cache, "clear"):
                cache.clear()
        except Exception as exc:
            logger.debug("Failed to clear market read cache for events: %s", exc)

        logger.info(
            "Events ingestion cycle succeeded: %d corporate events active and pruned",
            len(events),
        )
        return {
            "status": "success",
            "total_events": len(events),
        }
    except Exception as exc:
        logger.error("Failed during events ingestion cycle: %s", exc, exc_info=True)
        return {
            "status": "error",
            "error": str(exc),
        }


@celery_app.task(name="investiq.events.crawl.v1", soft_time_limit=120, time_limit=180)  # type: ignore[untyped-decorator]
def crawl_corporate_events() -> dict[str, Any]:
    """Celery-compatible task for scheduled corporate events ingestion."""
    return run_events_ingestion_cycle()
