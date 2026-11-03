"""Unit tests for stock basics learning curriculum and admin management."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.deps import require_admin_user, require_auth_bff
from app.main import app

client = TestClient(app)


def test_get_learning_topics_curriculum() -> None:
    """Test retrieving published topics list with level filters."""
    response = client.get("/api/v1/learning/topics")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 9

    # Check levels presence
    levels = {item["level"] for item in data}
    assert "beginner" in levels
    assert "intermediate" in levels
    assert "advanced" in levels

    # Filter by beginner
    res_beg = client.get("/api/v1/learning/topics?level=beginner")
    assert res_beg.status_code == 200
    beg_data = res_beg.json()
    assert len(beg_data) >= 3
    assert all(item["level"] == "beginner" for item in beg_data)

    # Filter by advanced
    res_adv = client.get("/api/v1/learning/topics?level=advanced")
    assert res_adv.status_code == 200
    adv_data = res_adv.json()
    assert len(adv_data) >= 3
    assert all(item["level"] == "advanced" for item in adv_data)


def test_get_learning_topic_detail_and_404() -> None:
    """Test retrieving lesson detail and error handling for nonexistent lesson."""
    slug = "stock-basics-saving-vs-investing"
    response = client.get(f"/api/v1/learning/topics/{slug}")
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == slug
    assert "Cổ phiếu là gì" in data["theory_content"]
    assert "practical_example" in data
    assert data["practical_example"]["ticker"] == "HPG"
    assert len(data["quizzes"]) >= 2
    assert len(data["glossary"]) >= 2

    # Nonexistent
    res_404 = client.get("/api/v1/learning/topics/nonexistent-lesson-slug")
    assert res_404.status_code == 404


def test_submit_quiz_evaluation() -> None:
    """Test automated quiz grading with full marks and wrong answers."""
    slug = "stock-basics-saving-vs-investing"

    # Submit correct answers
    correct_payload = {
        "answers": {
            "q1": "opt2",  # Gửi tài khoản tiết kiệm
            "q2": "opt2",  # Cổ đông sở hữu một phần vốn
        }
    }
    res_correct = client.post(f"/api/v1/learning/topics/{slug}/submit-quiz", json=correct_payload)
    assert res_correct.status_code == 200
    data_correct = res_correct.json()
    assert data_correct["score"] == 2
    assert data_correct["total"] == 2
    assert data_correct["percentage"] == 100.0
    assert data_correct["passed"] is True
    assert all(d["correct"] is True for d in data_correct["details"])

    # Submit wrong answers
    wrong_payload = {
        "answers": {
            "q1": "opt1",  # Mua mã đang tăng trần nóng nhất
            "q2": "opt2",
        }
    }
    res_wrong = client.post(f"/api/v1/learning/topics/{slug}/submit-quiz", json=wrong_payload)
    assert res_wrong.status_code == 200
    data_wrong = res_wrong.json()
    assert data_wrong["score"] == 1
    assert data_wrong["passed"] is False
    assert data_wrong["percentage"] == 50.0
    q1_detail = next(d for d in data_wrong["details"] if d["question_id"] == "q1")
    assert q1_detail["correct"] is False
    assert "Chưa đúng" in q1_detail["feedback"]


def test_admin_learning_lifecycle_with_auth_override() -> None:
    """Test admin learning CRUD with mock admin identity."""
    app.dependency_overrides[require_admin_user] = lambda: "admin-user-id"
    app.dependency_overrides[require_auth_bff] = lambda: True

    try:
        # 1. List topics
        res_list = client.get("/api/v1/admin/learning/topics")
        assert res_list.status_code == 200
        page_data = res_list.json()
        assert page_data["total"] >= 9

        # 2. Create topic
        create_payload = {
            "slug": "test-admin-lesson-new",
            "level": "intermediate",
            "stage": 2,
            "sort_order": 99,
            "title": "Bài học thử nghiệm của Admin",
            "eyebrow": "THỬ NGHIỆM",
            "summary": "Tóm tắt bài học thử nghiệm quản trị viên tạo.",
            "estimated_minutes": 6,
            "theory_content": "Nội dung lý thuyết thử nghiệm chi tiết dài hơn 20 ký tự.",
            "practical_example": {
                "title": "Ví dụ thực tế HPG",
                "ticker": "HPG",
                "scenario": "Tình huống thử nghiệm thực tế.",
                "analysis": "Phân tích thử nghiệm.",
                "key_takeaway": "Bài học rút ra."
            },
            "quizzes": [
                {
                    "id": "tq1",
                    "prompt": "Câu hỏi thử nghiệm 1?",
                    "options": [
                        {"id": "o1", "label": "Lựa chọn 1", "correct": True, "feedback": "Đúng rồi"},
                        {"id": "o2", "label": "Lựa chọn 2", "correct": False, "feedback": "Sai rồi"}
                    ]
                }
            ],
            "status": "draft"
        }
        res_create = client.post("/api/v1/admin/learning/topics", json=create_payload)
        assert res_create.status_code == 201
        created_data = res_create.json()
        created_id = created_data["id"]
        assert created_data["slug"] == "test-admin-lesson-new"
        assert created_data["status"] == "draft"

        # 3. Update topic
        update_payload = {
            "title": "Bài học thử nghiệm đã cập nhật tiêu đề",
            "status": "published"
        }
        res_update = client.put(f"/api/v1/admin/learning/topics/{created_id}", json=update_payload)
        assert res_update.status_code == 200
        assert res_update.json()["title"] == "Bài học thử nghiệm đã cập nhật tiêu đề"
        assert res_update.json()["status"] == "published"

        # 4. Toggle status
        res_toggle = client.patch(
            f"/api/v1/admin/learning/topics/{created_id}/status",
            json={"status": "draft"}
        )
        assert res_toggle.status_code == 200
        assert res_toggle.json()["new_status"] == "draft"

        # 5. Delete topic
        res_delete = client.delete(f"/api/v1/admin/learning/topics/{created_id}")
        assert res_delete.status_code == 200
        assert res_delete.json()["status"] == "ok"

        # Verify deletion
        res_get_deleted = client.get(f"/api/v1/admin/learning/topics/{created_id}")
        assert res_get_deleted.status_code == 404

    finally:
        app.dependency_overrides.pop(require_admin_user, None)
        app.dependency_overrides.pop(require_auth_bff, None)
