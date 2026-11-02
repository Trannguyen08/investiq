import pytest
from starlette.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(autouse=True)
def mock_no_db(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.infrastructure.db.repositories.sql_event_reminder_repository as repo_mod

    monkeypatch.setattr(
        repo_mod, "get_pool", lambda: (_ for _ in ()).throw(RuntimeError("No DB in unit test"))
    )


def test_event_reminders_crud_and_quick_test(client: TestClient) -> None:
    payload = {
        "email": "investor@investiq.vn",
        "event_id": "TCB-2026-11-16",
        "symbol": "TCB",
        "event_title": "Niêm yết bổ sung 350.5 triệu cổ phiếu",
        "event_date": "2026-11-16",
        "event_type": "additional_listing",
        "remind_days_before": 1,
        "extra_info": {"notes": "Test reminder"},
    }

    # 1. Quick test endpoint
    res_quick = client.post(
        "/api/v1/market/events/reminders/quick-test",
        json=payload,
    )
    assert res_quick.status_code == 200
    data_quick = res_quick.json()
    assert data_quick["success"] is True
    assert "thành công" in data_quick["message"]

    # 2. Create reminder
    res_create = client.post("/api/v1/market/events/reminders", json=payload)
    assert res_create.status_code == 200
    create_body = res_create.json()
    assert create_body["success"] is True
    reminder_id = create_body["reminder_id"]
    assert reminder_id is not None

    # 3. List reminders by email
    res_list = client.get(
        "/api/v1/market/events/reminders",
        params={"email": "investor@investiq.vn"},
    )
    assert res_list.status_code == 200
    items = res_list.json()["data"]
    assert any(item["id"] == reminder_id for item in items)

    # 4. Test send email
    res_test = client.post(f"/api/v1/market/events/reminders/{reminder_id}/test-send")
    assert res_test.status_code == 200
    assert res_test.json()["success"] is True

    # 5. Delete reminder
    res_del = client.delete(f"/api/v1/market/events/reminders/{reminder_id}")
    assert res_del.status_code == 200
    assert res_del.json()["success"] is True
