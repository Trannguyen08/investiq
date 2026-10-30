from __future__ import annotations

import json
from decimal import Decimal
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.infrastructure.external.crawlers.dividend_crawler import (
    DividendCrawler,
    _classify_dividend,
    _parse_epoch_date,
)
from app.infrastructure.external.crawlers.financial_statements_crawler import (
    FinancialStatementsCrawler,
)
from app.main import app


def test_parse_epoch_date():
    assert _parse_epoch_date("/Date(1717088400000)/") == "2024-05-31"
    assert _parse_epoch_date("25/12/2024") == "2024-12-25"
    assert _parse_epoch_date("2024-12-25T00:00:00") == "2024-12-25"
    assert _parse_epoch_date("") == ""


def test_classify_dividend():
    div_type, ratio, cash = _classify_dividend("Trả cổ tức năm 2023 bằng tiền mặt tỷ lệ 10%")
    assert div_type == "cash"
    assert ratio == "10%"
    assert cash == Decimal("1000")

    div_type, ratio, cash = _classify_dividend("Trả cổ tức năm 2023 bằng cổ phiếu tỷ lệ 100:10")
    assert div_type == "stock"
    assert ratio == "100:10"
    assert cash is None

    div_type, ratio, cash = _classify_dividend("Phát hành cổ phiếu thưởng tỷ lệ 10:1")
    assert div_type == "bonus"
    assert ratio == "10:1"


def test_dividend_crawler_parse_cafef():
    mock_cafef_data = {
        "Success": True,
        "Data": [
            {
                "Time": "/Date(1717088400000)/",
                "Text": ["Trả cổ tức đợt 1 năm 2024 bằng tiền (5%)"],
            }
        ],
    }

    crawler = DividendCrawler()
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = json.dumps(mock_cafef_data).encode("utf-8")
        mock_urlopen.return_value.__enter__.return_value = mock_resp

        result = crawler.get_symbol_dividends("HPG")
        assert len(result) >= 1
        assert result[0]["symbol"] == "HPG"
        assert result[0]["type"] == "cash"
        assert result[0]["cash_value"] == 500.0


def test_financial_statements_crawler_parse():
    mock_response = [
        {
            "code": "dttbhccdv",
            "name": "Doanh thu bán hàng và cung cấp dịch vụ",
            "values": [35000000000000.0, 30000000000000.0, 28000000000000.0, 25000000000000.0],
        },
        {
            "code": "lnsttndn",
            "name": "Lợi nhuận sau thuế thu nhập doanh nghiệp",
            "values": [3500000000000.0, 2800000000000.0, 2000000000000.0, 1500000000000.0],
        },
    ]

    crawler = FinancialStatementsCrawler()
    with patch.object(crawler, "_fetch_report") as mock_fetch:
        mock_fetch.return_value = {
            "periods": ["Q3 2024", "Q2 2024", "Q1 2024", "Q4 2023"],
            "metrics": mock_response,
        }

        result = crawler.get_financial_statements("HPG", period_type="quarter", limit=4)
        assert result["symbol"] == "HPG"
        assert len(result["periods"]) == 4
        assert len(result["charts"]) == 4
        # Chronological: oldest to newest
        assert result["charts"][0]["period"] == "Q4 2023"
        assert result["charts"][3]["period"] == "Q3 2024"
        assert result["charts"][3]["revenue_billion"] == 35000.0


def test_api_dividend_calendar_and_stock_endpoints():
    client = TestClient(app)

    # 1. Calendar endpoint
    res_cal = client.get("/api/v1/market/dividends/calendar?limit=10")
    assert res_cal.status_code == 200
    cal_data = res_cal.json()
    assert "data" in cal_data
    assert "events" in cal_data["data"]

    # 2. Instrument dividends endpoint
    res_div = client.get("/api/v1/market/instruments/HPG/dividends")
    assert res_div.status_code == 200
    div_data = res_div.json()
    assert div_data["data"]["symbol"] == "HPG"
    assert "events" in div_data["data"]

    # 3. Instrument financial statements endpoint
    res_fs = client.get(
        "/api/v1/market/instruments/HPG/financial-statements?period_type=quarter&limit=4"
    )
    assert res_fs.status_code == 200
    fs_data = res_fs.json()
    assert fs_data["data"]["symbol"] == "HPG"
    assert "charts" in fs_data["data"]
    assert "income_statement" in fs_data["data"]
