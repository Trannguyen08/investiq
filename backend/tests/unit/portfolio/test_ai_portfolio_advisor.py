from app.application.use_cases.portfolio.ai_portfolio_advisor import generate_ai_portfolio_review
from app.infrastructure.db.repositories.sql_paper_report_repository import SqlPaperReportRepository
from app.infrastructure.external.notifications.paper_portfolio_email import (
    build_paper_portfolio_email_html,
    send_paper_portfolio_daily_email,
)


def test_ai_portfolio_advisor_deep_loss():
    account = {
        "starting_cash": "1000000000",
        "total_value": "950000000",
        "available_cash": "300000000",
        "invested_cost": "700000000",
        "total_pnl": "-50000000",
        "total_return_percent": "-5.0%",
    }
    holdings = [
        {
            "symbol": "VNM",
            "name": "Vinamilk",
            "quantity": 5000,
            "average_cost": "75000",
            "current_price": "67000",
            "market_value": "335000000",
            "unrealized_pnl": "-40000000",
            "unrealized_pnl_percent": "-10.67%",
        },
        {
            "symbol": "FPT",
            "name": "FPT Corp",
            "quantity": 3000,
            "average_cost": "100000",
            "current_price": "105000",
            "market_value": "315000000",
            "unrealized_pnl": "15000000",
            "unrealized_pnl_percent": "+5.0%",
        },
    ]

    review = generate_ai_portfolio_review(account, holdings)

    assert review.portfolio_health_score < 80
    assert "CẢNH BÁO BẢO TOÀN VỐN" in review.stop_loss_discipline
    assert "VNM" in review.stop_loss_discipline
    assert len(review.action_items) > 0


def test_ai_portfolio_advisor_take_profit():
    account = {
        "starting_cash": "1000000000",
        "total_value": "1150000000",
        "available_cash": "400000000",
        "invested_cost": "600000000",
        "total_pnl": "150000000",
        "total_return_percent": "+15.0%",
    }
    holdings = [
        {
            "symbol": "HPG",
            "name": "Hòa Phát",
            "quantity": 20000,
            "average_cost": "25000",
            "current_price": "30000",
            "market_value": "600000000",
            "unrealized_pnl": "100000000",
            "unrealized_pnl_percent": "+20.0%",
        }
    ]

    review = generate_ai_portfolio_review(account, holdings)

    assert "HIỆN THỰC HÓA THÀNH QUẢ" in review.take_profit_strategy
    assert "HPG" in review.take_profit_strategy
    assert "KỶ LUẬT KIỂM SOÁT TỐT" in review.stop_loss_discipline


def test_paper_portfolio_email_builder_and_sending():
    account = {
        "starting_cash": "1000000000",
        "total_value": "1050000000",
        "available_cash": "450000000",
        "invested_cost": "600000000",
        "total_pnl": "50000000",
        "total_return_percent": "+5.0%",
    }
    holdings = [
        {
            "symbol": "FPT",
            "name": "FPT Corp",
            "quantity": 5000,
            "average_cost": "120000",
            "current_price": "130000",
            "market_value": "650000000",
            "unrealized_pnl": "50000000",
            "unrealized_pnl_percent": "+8.33%",
        }
    ]
    review = generate_ai_portfolio_review(account, holdings)
    html = build_paper_portfolio_email_html("test@example.com", account, review)

    assert "INVESTIQ PAPER TRADING" in html
    assert "FPT" in html
    assert "GÓC NHÌN CHUYÊN GIA AI" in html
    assert "Quản Trị Vốn" in html

    success, msg = send_paper_portfolio_daily_email("test@example.com", account, review)
    assert success is True


def test_sql_paper_report_repository_fallback():
    repo = SqlPaperReportRepository(None)
    sub = repo.upsert_subscription("user-999", "tester@investiq.vn", is_active=True)
    assert sub["user_id"] == "user-999"
    assert sub["email"] == "tester@investiq.vn"
    assert sub["is_active"] is True

    fetched = repo.get_subscription("user-999")
    assert fetched is not None
    assert fetched["email"] == "tester@investiq.vn"

    active_subs = repo.list_active_subscriptions()
    assert any(s["user_id"] == "user-999" for s in active_subs)
