"""Unit tests for investor persona, trading discipline, and readiness evaluation endpoints."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.deps import require_admin_user, require_auth_bff
from app.main import app

client = TestClient(app)


def test_get_assessment_questions() -> None:
    """Test retrieving published survey questions with options."""
    response = client.get("/api/v1/assessment/questions")
    assert response.status_code == 200
    questions = response.json()
    assert len(questions) == 10

    first = questions[0]
    assert "prompt" in first
    assert "category" in first
    assert len(first["options"]) >= 4
    for opt in first["options"]:
        assert "risk_weight" in opt
        assert "persona_weights" in opt


def test_get_investor_personas() -> None:
    """Test retrieving the 4 investor persona archetypes."""
    response = client.get("/api/v1/assessment/personas")
    assert response.status_code == 200
    personas = response.json()
    assert len(personas) == 4
    codes = {p["code"] for p in personas}
    assert "dca_accumulator" in codes
    assert "value_growth" in codes
    assert "active_swing" in codes
    assert "conservative_fund" in codes

    # Test detail
    res_detail = client.get("/api/v1/assessment/personas/dca_accumulator")
    assert res_detail.status_code == 200
    detail = res_detail.json()
    assert detail["title"] == "Nhà đầu tư Tích sản Dài hạn (DCA)"
    assert "stocks" in detail["asset_allocation"]


def test_submit_and_evaluate_assessment() -> None:
    """Test submitting assessment answers and receiving tailored readiness verdict."""
    payload = {
        "answers": {
            "1": "q1_opt1",  # Tích lũy tài sản đều đặn hàng tháng
            "2": "q2_opt1",  # Bình tĩnh rà soát, mua thêm giá rẻ
            "3": "q3_opt1",  # Dưới 2h/tuần
            "4": "q4_opt1",  # Tiền nhàn rỗi dài hạn 3-5 năm
            "5": "q5_opt2",  # Hiểu P/E, P/B
            "6": "q6_opt3",  # Tự nghiên cứu, không FOMO
            "7": "q7_opt2",  # Tích sản dài hạn giữ hoặc mua thêm
            "8": "q8_opt2",  # Đã từng mua vàng, tiết kiệm
            "9": "q9_opt1",  # Kỳ vọng 10-15%/năm
            "10": "q10_opt1",  # Bình tĩnh hiểu thị trường phục hồi
        },
        "knowledge_score": 80.0,
        "discipline_score": 85.0,
    }
    response = client.post("/api/v1/assessment/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["persona"]["code"] == "dca_accumulator"
    assert data["risk_score"] > 0
    assert data["overall_readiness_score"] >= 70.0
    assert data["can_trade_real_money"] is True
    assert "verdict_summary" in data

    # Test latest report
    res_latest = client.get("/api/v1/assessment/latest")
    assert res_latest.status_code == 200
    assert res_latest.json() is not None


def test_get_trading_discipline_metrics() -> None:
    """Test computing trading discipline score from mock portfolio."""
    response = client.get("/api/v1/assessment/discipline")
    assert response.status_code == 200
    data = response.json()
    assert "overall_discipline_score" in data
    assert "cut_loss_score" in data
    assert "diversification_score" in data
    assert "badge" in data
    assert isinstance(data["strengths"], list)


def test_admin_assessment_crud_and_stats() -> None:
    """Test admin assessment questions management and statistics."""
    app.dependency_overrides[require_admin_user] = lambda: "admin-user-id"
    app.dependency_overrides[require_auth_bff] = lambda: True

    try:
        # 1. Stats
        res_stats = client.get("/api/v1/admin/assessment/stats")
        assert res_stats.status_code == 200
        stats = res_stats.json()
        assert "total_assessments" in stats
        assert "persona_distribution" in stats

        # 2. Submissions list
        res_subs = client.get("/api/v1/admin/assessment/submissions")
        assert res_subs.status_code == 200
        page = res_subs.json()
        assert "items" in page

        # 3. Create question
        new_q = {
            "sort_order": 99,
            "category": "market_psychology",
            "prompt": "Câu hỏi khảo sát thử nghiệm của quản trị viên?",
            "subtext": "Mô tả phụ thử nghiệm.",
            "options": [
                {
                    "id": "t_opt1",
                    "label": "Lựa chọn thử nghiệm 1",
                    "risk_weight": 50,
                    "persona_weights": {"dca_accumulator": 5, "value_growth": 5},
                },
                {
                    "id": "t_opt2",
                    "label": "Lựa chọn thử nghiệm 2",
                    "risk_weight": 70,
                    "persona_weights": {"active_swing": 8, "conservative_fund": 2},
                },
            ],
            "status": "draft",
        }
        res_create = client.post("/api/v1/admin/assessment/questions", json=new_q)
        assert res_create.status_code == 201
        created = res_create.json()
        q_id = created["id"]
        assert created["status"] == "draft"

        # 4. Update question
        res_update = client.put(
            f"/api/v1/admin/assessment/questions/{q_id}",
            json={"prompt": "Câu hỏi đã được cập nhật nội dung?"},
        )
        assert res_update.status_code == 200
        assert res_update.json()["prompt"] == "Câu hỏi đã được cập nhật nội dung?"

        # 5. Toggle status
        res_toggle = client.patch(
            f"/api/v1/admin/assessment/questions/{q_id}/status",
            json={"status": "published"},
        )
        assert res_toggle.status_code == 200
        assert res_toggle.json()["new_status"] == "published"

        # 6. Delete question
        res_delete = client.delete(f"/api/v1/admin/assessment/questions/{q_id}")
        assert res_delete.status_code == 200
        assert res_delete.json()["status"] == "ok"

        # 7. Update Persona
        res_persona_update = client.put(
            "/api/v1/admin/assessment/personas/dca_accumulator",
            json={"ideal_time_hours_per_week": 3},
        )
        assert res_persona_update.status_code == 200
        assert res_persona_update.json()["ideal_time_hours_per_week"] == 3

    finally:
        app.dependency_overrides.pop(require_admin_user, None)
        app.dependency_overrides.pop(require_auth_bff, None)
