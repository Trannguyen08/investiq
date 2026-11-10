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

import html
import logging
import re
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

DEAD_CONTENT_PATTERNS = (
    "đường dẫn hoặc bài viết không tồn tại",
    "bài viết không tồn tại",
    "tin bài không tìm thấy",
    "nội dung không tồn tại",
    "nội dung này không tồn tại",
    "không tìm thấy trang",
    "trang không tìm thấy",
    "trang bạn tìm kiếm không tồn tại",
    "bài viết đã bị xóa",
    "liên kết không tồn tại",
    "trang thông báo lỗi 404",
    "404 not found",
    "page not found",
    "the requested url was not found",
    "404 - ",
)


def check_url_integrity(url: str, timeout: float = 6.0) -> tuple[bool, int | None, str]:
    """Check if a source URL is definitively dead (404/410/DNS/Soft 404/Redirected).

    Returns (is_dead: bool, status_code: int | None, reason: str).
    Covers:
    1. HTTP 404/410 status codes.
    2. Redirected to 404/error landing paths (/404.html, /404.chn, /notfound, etc.).
    3. Deep article/event path redirected to generic root homepage (/).
    4. Soft 404s returning 200 OK but displaying Vietnamese not-found text.
    5. Client-side meta-refresh or delayed JS redirects that forward away from not-found pages.
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
            resp = client.get(trimmed)
            status = resp.status_code
            if status in (404, 410):
                return True, status, "not_found"
            if status >= 500 or status in (401, 403, 429):
                # Temporary server issues or Cloudflare bot challenges shouldn't delete legitimate articles
                return False, status, "protected_or_server_error"

            final_url = str(resp.url)
            parsed_final = urlparse(final_url)
            final_path = parsed_final.path.lower()

            # 1. Redirected to known 404/error landing paths
            if any(p in final_path for p in ("/404", "/notfound", "/error", "trang-khong-ton-tai")):
                return True, status, f"redirected_to_404_path:{final_path}"

            # 2. Deep article/event path redirected to generic root homepage
            if len(parsed.path.strip("/")) > 5 and parsed_final.path in ("", "/"):
                return True, status, "redirected_to_homepage"

            # 3. Content inspection for Soft-404 in HTML
            raw_text = resp.text
            unescaped = html.unescape(raw_text).lower()

            # Check title tag
            titles = re.findall(r"<title[^>]*>(.*?)</title>", unescaped, re.DOTALL)
            title_text = titles[0].strip() if titles else ""
            for phrase in DEAD_CONTENT_PATTERNS:
                if phrase in title_text:
                    return True, status, f"dead_title:{phrase}"

            # Check h1 tag
            h1s = re.findall(r"<h1[^>]*>(.*?)</h1>", unescaped, re.DOTALL)
            for h1 in h1s:
                for phrase in DEAD_CONTENT_PATTERNS:
                    if phrase in h1:
                        return True, status, f"dead_h1:{phrase}"

            # Check general body text
            for phrase in DEAD_CONTENT_PATTERNS:
                if phrase in unescaped:
                    return True, status, f"dead_content:{phrase}"

            # 4. Meta refresh redirect check (e.g. <meta http-equiv="refresh" content="5;url=...">)
            for match in re.finditer(
                r'<meta[^>]*http-equiv=["\']?refresh["\']?[^>]*content=["\']?([^"\'>]+)["\']?',
                unescaped,
            ):
                mr = match.group(1).lower()
                if "url" in mr and any(k in mr for k in ("url=/", "url=https://", "404", "error")):
                    return True, status, f"meta_refresh_redirect:{mr}"

            return False, status, "ok"
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
