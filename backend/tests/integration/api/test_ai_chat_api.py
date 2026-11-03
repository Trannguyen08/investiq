from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.anyio
async def test_ai_chat_endpoint_guest() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/ai/chat",
            json={"message": "Đánh giá cổ phiếu HPG"},
        )
        assert response.status_code == 200
        body = response.json()
        assert "conversation_id" in body
        assert "message" in body
        msg = body["message"]
        assert msg["role"] == "assistant"
        assert "HPG" in msg["content"]
        assert len(msg["widgets"]) >= 1
        assert len(msg["suggested_actions"]) >= 1


@pytest.mark.anyio
async def test_ai_chat_endpoint_general_prompt() -> None:
    with patch(
        "app.application.use_cases.ai_chat.ai_financial_service.AiFinancialService._search_external_info"
    ) as mock_search:
        mock_search.return_value = ""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(
                "/api/v1/ai/chat",
                json={"message": "Xin chào, bạn có thể giúp gì cho tôi?"},
            )
            assert response.status_code == 200
            body = response.json()
            assert "InvestIQ" in body["message"]["content"]
