"""Unit tests for the Link Integrity Worker and cancellation notifications."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from app.domain.entities.market import MarketEvent
from app.infrastructure.external.notifications.event_reminder_email import (
    render_event_cancellation_html,
    send_event_cancellation_email,
)
from app.workers.link_integrity_worker import (
    check_url_integrity,
    run_link_integrity_cycle,
    verify_and_clean_corporate_events,
    verify_and_clean_news_articles,
)


def test_check_url_integrity_status_codes() -> None:
    """Test URL checking logic with different mock HTTP response codes."""
    import httpx

    # 1. 200 OK -> healthy
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.url = httpx.URL("https://cafef.vn/active-link.chn")
        mock_resp.text = "<html><head><title>Báo cáo tài chính</title></head><body><h1>Doanh nghiệp lãi lớn</h1></body></html>"
        mock_get.return_value = mock_resp

        is_dead, code, reason = check_url_integrity("https://cafef.vn/active-link.chn")
        assert not is_dead
        assert code == 200
        assert reason == "ok"

    # 2. 404 Not Found -> dead
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_resp.url = httpx.URL("https://cafef.vn/broken-link-404.chn")
        mock_resp.text = "Not Found"
        mock_get.return_value = mock_resp

        is_dead, code, reason = check_url_integrity("https://cafef.vn/broken-link-404.chn")
        assert is_dead
        assert code == 404
        assert reason == "not_found"

    # 3. 410 Gone -> dead
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 410
        mock_resp.url = httpx.URL("https://vietstock.vn/gone-410.htm")
        mock_resp.text = "Gone"
        mock_get.return_value = mock_resp

        is_dead, code, reason = check_url_integrity("https://vietstock.vn/gone-410.htm")
        assert is_dead
        assert code == 410
        assert reason == "not_found"

    # 4. 403 Forbidden / Cloudflare challenge -> NOT treated as dead to avoid data loss
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        mock_resp.url = httpx.URL("https://s.cafef.vn/cf-protected.chn")
        mock_resp.text = "Cloudflare Challenge"
        mock_get.return_value = mock_resp

        is_dead, code, reason = check_url_integrity("https://s.cafef.vn/cf-protected.chn")
        assert not is_dead
        assert code == 403

    # 5. Soft-404: 200 OK but page body says "bài viết không tồn tại"
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.url = httpx.URL("https://finance.vietstock.vn/dead-post.htm")
        mock_resp.text = "<html><body><h1>Đường dẫn hoặc bài viết không tồn tại.</h1></body></html>"
        mock_get.return_value = mock_resp

        is_dead, code, reason = check_url_integrity("https://finance.vietstock.vn/dead-post.htm")
        assert is_dead
        assert code == 200
        assert "dead_h1" in reason

    # 6. Delayed redirect / 404 landing page
    with patch("httpx.Client.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.url = httpx.URL("https://vnexpress.net/404.html")
        mock_resp.text = "<html><head><meta http-equiv='refresh' content='2;url=https://vnexpress.net/'></head></html>"
        mock_get.return_value = mock_resp

        is_dead, code, reason = check_url_integrity("https://vnexpress.net/old-article-123.html")
        assert is_dead
        assert code == 200
        assert "redirected_to_404_path" in reason

    # 7. Malformed URL -> dead
    is_dead, code, reason = check_url_integrity("not-a-valid-url")
    assert is_dead
    assert code == 400


def test_send_event_cancellation_email_preview() -> None:
    """Test generating and storing cancellation email preview for dummy/test emails."""
    html = render_event_cancellation_html(
        symbol="VNM",
        event_title="Họp ĐHĐCĐ bất thường 2026",
        event_type="shareholder_meeting",
        source_url="https://s.cafef.vn/lich-su-kien.chn?id=vnm-test-404",
        reason="Trang công bố nguồn trả về lỗi 404 Not Found.",
    )
    assert "VNM" in html
    assert "Họp ĐHĐCĐ bất thường 2026" in html
    assert "ĐÃ GỠ KHỎI HỆ THỐNG THEO DÕI" in html
    assert "404 Not Found" in html

    success, msg = send_event_cancellation_email(
        to_email="investor@example.com",
        symbol="VNM",
        event_title="Họp ĐHĐCĐ bất thường 2026",
        event_type="shareholder_meeting",
        source_url="https://s.cafef.vn/lich-su-kien.chn?id=vnm-test-404",
    )
    assert success
    assert "Bản xem trước thông báo hủy sự kiện đã lưu" in msg


def test_verify_and_clean_corporate_events() -> None:
    """Test that dead events are pruned, subscribers are notified, and reminders cancelled."""
    test_event_id = "test-dead-event-123"
    test_event = MarketEvent(
        id=test_event_id,
        symbol="HPG",
        event_type="cash_dividend",
        title="Chi trả cổ tức thử nghiệm 2026",
        summary="Sự kiện kiểm thử worker link",
        date_type="ex_right_date",
        event_at=datetime.now(UTC),
        status="official",
        source_name="Nguồn tin tức",
        source_url="https://s.cafef.vn/dead-hpg-event-404.chn",
    )

    mock_crawler = MagicMock()
    mock_crawler.get_all_events.return_value = [test_event]
    mock_crawler.remove_event_by_id.return_value = True

    mock_repo = MagicMock()
    mock_repo.get_pending_by_event_id.return_value = [
        {"email": "investor1@example.com", "event_id": test_event_id},
        {"email": "investor2@investiq.vn", "event_id": test_event_id},
    ]

    with (
        patch("app.infrastructure.external.crawlers.corporate_events_crawler.get_corporate_events_crawler", return_value=mock_crawler),
        patch("app.infrastructure.db.repositories.sql_event_reminder_repository.get_event_reminder_repository", return_value=mock_repo),
        patch("app.workers.link_integrity_worker.check_url_integrity", return_value=(True, 404, "not_found")),
        patch("app.workers.link_integrity_worker.get_pool") as mock_pool,
        patch("app.infrastructure.external.notifications.event_reminder_email.send_event_cancellation_email") as mock_send_email,
    ):
        mock_conn = MagicMock()
        mock_pool.return_value.connection.return_value.__enter__.return_value = mock_conn

        res = verify_and_clean_corporate_events()

        assert res["checked_events"] == 1
        assert res["dead_events_removed"] == 1
        assert res["notified_subscribers"] == 2

        # Verify crawler removed the event
        mock_crawler.remove_event_by_id.assert_called_once_with(test_event_id)

        # Verify notification emails were sent
        assert mock_send_email.call_count == 2

        # Verify reminders were cancelled in repo
        mock_repo.cancel_reminders_for_event.assert_called_once()


def test_verify_and_clean_news_articles() -> None:
    """Test that dead news articles are marked as withdrawn."""
    mock_pool = MagicMock()
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_pool.return_value.connection.return_value.__enter__.return_value = mock_conn
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur

    # Mock DB query returning 1 published article
    mock_cur.fetchall.return_value = [
        ("00000000-0000-0000-0000-000000000001", "https://vnexpress.net/broken-news-404.html", "Tin kinh tế")
    ]

    with (
        patch("app.workers.link_integrity_worker.get_pool", mock_pool),
        patch("app.workers.link_integrity_worker.check_url_integrity", return_value=(True, 404, "not_found")),
    ):
        res = verify_and_clean_news_articles(limit=10)
        assert res["checked_news"] == 1
        assert res["dead_news_withdrawn"] == 1

        # Check DB update executed
        mock_cur.execute.assert_any_call(
            """
                    UPDATE news_articles
                    SET visibility = 'withdrawn', updated_at = now()
                    WHERE id = %s
                    """,
            ("00000000-0000-0000-0000-000000000001",),
        )


def test_run_link_integrity_cycle() -> None:
    """Test orchestrator function runs both corporate events and news verification."""
    with (
        patch("app.workers.link_integrity_worker.verify_and_clean_corporate_events", return_value={"checked_events": 5, "dead_events_removed": 1, "notified_subscribers": 1}),
        patch("app.workers.link_integrity_worker.verify_and_clean_news_articles", return_value={"checked_news": 10, "dead_news_withdrawn": 2}),
    ):
        summary = run_link_integrity_cycle()
        assert summary["status"] == "success"
        assert summary["events"]["dead_events_removed"] == 1
        assert summary["news"]["dead_news_withdrawn"] == 2
