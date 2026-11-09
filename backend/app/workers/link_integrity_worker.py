"""Continuous link integrity monitor and dead resource cleanup worker.

Verifies external source links for:
1. Corporate events & dividend schedules (home & market events).
2. Published news articles.

When a link returns 404 / 410 or DNS dead:
- Automatically deletes/purges the event from the system.
- Notifies affected users who scheduled reminders for that event via email.
- Cancels pending reminders in the repository.
- Withdraws/deletes 404 news articles.
- Clears market and news caches so changes are reflected in UI immediately.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from urllib.parse import urlparse

import httpx

from app.infrastructure.db.session import get_pool
from app.workers.celery_app import celery_app

logger = logging.getLogger("investiq.links.worker")

CHROME_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)


def check_url_integrity(url: str, timeout: float = 6.0) -> tuple[bool, int | None, str]:
    """Check if a source URL is definitively dead (404/410/DNS resolution failure).

    Returns (is_dead: bool, status_code: int | None, reason: str).
    Only 404, 410, and clear DNS/host resolution failures are considered dead.
    Temporary 403, 429, 5xx, or timeouts are NOT considered dead to protect data.
    """
    if not url or not isinstance(url, str):
        return False, None, "empty_url"

    trimmed = url.strip()
    if not trimmed:
        return False, None, "empty_url"

    parsed = urlparse(trimmed)
    if not parsed.scheme or not parsed.netloc:
        return True, 400, "malformed_url"

    headers = {
        "User-Agent": CHROME_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi,en-US;q=0.9,en;q=0.8",
    }

    try:
        with httpx.Client(
            timeout=timeout,
            follow_redirects=True,
            verify=False,
            headers=headers,
        ) as client:
            try:
                resp = client.head(trimmed)
                if resp.status_code in (404, 410):
                    return True, resp.status_code, "not_found"
                if resp.status_code in (403, 405):
                    # Some news portals reject HEAD requests with 405 or Cloudflare 403; test with GET stream
                    with client.stream("GET", trimmed) as stream_resp:
                        if stream_resp.status_code in (404, 410):
                            return True, stream_resp.status_code, "not_found"
                        return False, stream_resp.status_code, "ok"
                return False, resp.status_code, "ok"
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code in (404, 410):
                    return True, exc.response.status_code, "not_found"
                return False, exc.response.status_code, "http_status_error"
    except (httpx.ConnectError, httpx.NetworkError) as exc:
        err_msg = str(exc).lower()
        if (
            "getaddrinfo failed" in err_msg
            or "nodename nor servname" in err_msg
            or "name resolution" in err_msg
        ):
            return True, None, "dns_resolution_failed"
        return False, None, f"connect_error: {exc}"
    except httpx.TimeoutException:
        return False, None, "timeout"
    except Exception as exc:
        return False, None, f"unexpected_error: {exc}"


def verify_and_clean_corporate_events() -> dict[str, Any]:
    """Audit corporate events & dividends source URLs.

    If 404/410/dead:
    1. Remove from in-memory crawler registry.
    2. Notify users with pending reminders via cancellation email.
    3. Cancel reminders in database & repository.
    4. Cancel/mark status in market_events table if stored.
    5. Invalidate market cache.
    """
    from app.infrastructure.cache.market_cache import get_market_read_cache
    from app.infrastructure.db.repositories.sql_event_reminder_repository import (
        get_event_reminder_repository,
    )
    from app.infrastructure.external.crawlers.corporate_events_crawler import (
        get_corporate_events_crawler,
    )
    from app.infrastructure.external.notifications.event_reminder_email import (
        send_event_cancellation_email,
    )

    crawler = get_corporate_events_crawler()
    all_events = crawler.get_all_events()
    repo = get_event_reminder_repository()

    events_to_check: list[Any] = []
    dead_events: list[tuple[Any, int | None, str]] = []

    for e in all_events:
        url = getattr(e, "source_url", None)
        if not url or not str(url).strip():
            # Event has no official source link -> mark for removal
            dead_events.append((e, None, "missing_official_link"))
        else:
            events_to_check.append(e)

    def _check_evt(evt: Any) -> tuple[Any, bool, int | None, str]:
        is_dead, code, reason = check_url_integrity(evt.source_url)
        return evt, is_dead, code, reason

    if events_to_check:
        with ThreadPoolExecutor(max_workers=5, thread_name_prefix="event-link-check") as executor:
            futures = [executor.submit(_check_evt, evt) for evt in events_to_check]
            for fut in as_completed(futures):
                try:
                    evt, is_dead, code, reason = fut.result()
                    if is_dead:
                        dead_events.append((evt, code, reason))
                except Exception as exc:
                    logger.warning("Error checking event source URL: %s", exc)

    removed_count = 0
    notified_users_count = 0

    for evt, code, reason in dead_events:
        # 1. Remove from in-memory crawler registry
        if crawler.remove_event_by_id(evt.id):
            removed_count += 1
            logger.info(
                "Removed dead corporate event: %s (%s) - %s [status: %s, reason: %s]",
                evt.id,
                evt.symbol,
                evt.source_url,
                code,
                reason,
            )

        # 2. Update status in database if market_events table contains this event
        try:
            pool = get_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE market_events
                    SET status = 'cancelled', updated_at = now()
                    WHERE provider_event_id = %s OR id::text = %s
                    """,
                    (evt.id, evt.id),
                )
                conn.commit()
        except Exception as exc:
            logger.debug("Could not update market_events table for %s: %s", evt.id, exc)

        # 3. Retrieve all pending reminders for this event & send cancellation emails
        try:
            pending_reminders = repo.get_pending_by_event_id(evt.id)
            for reminder in pending_reminders:
                user_email = reminder.get("email")
                if user_email:
                    reason_msg = (
                        f"Liên kết công bố nguồn không còn khả dụng ({code or reason}). "
                        f"InvestIQ đã tự động loại bỏ sự kiện này khỏi lịch thị trường."
                    )
                    send_event_cancellation_email(
                        to_email=user_email,
                        symbol=evt.symbol,
                        event_title=evt.title,
                        event_type=evt.event_type,
                        source_url=evt.source_url,
                        reason=reason_msg,
                    )
                    notified_users_count += 1

            # 4. Cancel pending reminders in repository
            repo.cancel_reminders_for_event(evt.id, reason=f"source_{reason}_{code}")
        except Exception as exc:
            logger.error("Failed processing cancellation notices for event %s: %s", evt.id, exc)

    if removed_count > 0:
        try:
            cache = get_market_read_cache()
            if hasattr(cache, "clear"):
                cache.clear()
        except Exception as exc:
            logger.debug("Failed clearing market cache after event removal: %s", exc)

    return {
        "checked_events": len(events_to_check),
        "dead_events_removed": removed_count,
        "notified_subscribers": notified_users_count,
    }


def verify_and_clean_news_articles(limit: int = 60) -> dict[str, Any]:
    """Audit recent published news articles.

    If canonical source URL is 404/410/dead:
    1. Update visibility to 'withdrawn' in database.
    2. Clear market read cache so users no longer see the dead article.
    """
    from app.infrastructure.cache.market_cache import get_market_read_cache

    articles_to_check: list[dict[str, Any]] = []
    try:
        pool = get_pool()
        with pool.connection() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.id::text, a.canonical_url, coalesce(r.title, 'Tin tức') as title
                FROM news_articles a
                LEFT JOIN article_revisions r ON r.id = a.current_revision_id
                WHERE a.visibility = 'published' AND a.canonical_url IS NOT NULL
                ORDER BY a.feed_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
            for row in rows:
                articles_to_check.append({
                    "id": str(row[0]),
                    "canonical_url": row[1],
                    "title": row[2],
                })
    except Exception as exc:
        logger.warning("Could not query news articles for link integrity: %s", exc)
        return {"checked_news": 0, "dead_news_withdrawn": 0, "error": str(exc)}

    dead_articles: list[dict[str, Any]] = []

    def _check_art(art: dict[str, Any]) -> tuple[dict[str, Any], bool, int | None, str]:
        is_dead, code, reason = check_url_integrity(art["canonical_url"])
        return art, is_dead, code, reason

    if articles_to_check:
        with ThreadPoolExecutor(max_workers=5, thread_name_prefix="news-link-check") as executor:
            futures = [executor.submit(_check_art, art) for art in articles_to_check]
            for fut in as_completed(futures):
                try:
                    art, is_dead, code, reason = fut.result()
                    if is_dead:
                        art["status_code"] = code
                        art["reason"] = reason
                        dead_articles.append(art)
                except Exception as exc:
                    logger.warning("Error checking article source URL: %s", exc)

    withdrawn_count = 0
    for art in dead_articles:
        try:
            art_id = art["id"]
            pool = get_pool()
            with pool.connection() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE news_articles
                    SET visibility = 'withdrawn', updated_at = now()
                    WHERE id = %s
                    """,
                    (art_id,),
                )
                conn.commit()
                withdrawn_count += 1
                logger.info(
                    "Withdrew dead news article %s (%s) - %s [status: %s, reason: %s]",
                    art_id,
                    art["title"],
                    art["canonical_url"],
                    art.get("status_code"),
                    art.get("reason"),
                )
        except Exception as exc:
            logger.error("Failed withdrawing dead news article %s: %s", art.get("id"), exc)

    if withdrawn_count > 0:
        try:
            cache = get_market_read_cache()
            if hasattr(cache, "clear"):
                cache.clear()
        except Exception as exc:
            logger.debug("Failed clearing market cache after news withdrawal: %s", exc)

    return {
        "checked_news": len(articles_to_check),
        "dead_news_withdrawn": withdrawn_count,
    }


def run_link_integrity_cycle() -> dict[str, Any]:
    """Execute complete link integrity verification for corporate events and news."""
    logger.info("Starting link integrity verification cycle")
    events_result = verify_and_clean_corporate_events()
    news_result = verify_and_clean_news_articles()
    summary = {
        "status": "success",
        "events": events_result,
        "news": news_result,
    }
    logger.info("Link integrity verification cycle completed: %s", summary)
    return summary


@celery_app.task(name="investiq.links.verify.v1", soft_time_limit=180, time_limit=240)  # type: ignore[untyped-decorator]
def verify_link_integrity() -> dict[str, Any]:
    """Celery-compatible task for link integrity verification."""
    return run_link_integrity_cycle()
