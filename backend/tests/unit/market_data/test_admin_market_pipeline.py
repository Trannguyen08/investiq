from __future__ import annotations

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.api.deps import require_admin_user, require_auth_bff
from app.main import app

client = TestClient(app)


def test_admin_market_data_pipeline_unauthorized():
    res = client.get("/api/v1/admin/market-data-pipeline")
    # require_auth_bff rejects without auth cookie/token
    assert res.status_code in {401, 403}


def test_admin_market_data_pipeline_authorized():
    app.dependency_overrides[require_auth_bff] = lambda: {"user_id": "admin-1", "role": "admin"}
    app.dependency_overrides[require_admin_user] = lambda: "admin-1"

    try:
        res = client.get("/api/v1/admin/market-data-pipeline")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert len(data["crawlers"]) == 2
        crawler_ids = [c["id"] for c in data["crawlers"]]
        assert "dividend-crawler" in crawler_ids
        assert "financial-statements-crawler" in crawler_ids

        # Test clear cache
        res_clear = client.post("/api/v1/admin/market-data-pipeline/clear-cache")
        assert res_clear.status_code == 200
        assert res_clear.json()["status"] == "success"

        # Test sync dividends
        with patch(
            "app.infrastructure.external.crawlers.dividend_crawler.DividendCrawler.get_market_calendar"
        ) as mock_get:
            mock_get.return_value = [{"id": "1", "symbol": "HPG"}]
            res_sync = client.post("/api/v1/admin/market-data-pipeline/sync-dividends")
            assert res_sync.status_code == 200
            assert res_sync.json()["synced_count"] == 1
    finally:
        app.dependency_overrides.pop(require_auth_bff, None)
        app.dependency_overrides.pop(require_admin_user, None)
