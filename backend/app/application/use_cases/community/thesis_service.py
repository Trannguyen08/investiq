"""Proof-of-Thesis Arena use case service with live-price anti-cheat verification."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from app.domain.entities.thesis import InvestmentThesis
from app.domain.repositories.i_market_provider import IMarketProvider
from app.domain.repositories.i_thesis_repository import IThesisRepository


class ThesisValidationError(ValueError):
    pass


class ThesisService:
    def __init__(
        self,
        thesis_repo: IThesisRepository,
        market_provider: IMarketProvider,
    ) -> None:
        self._repo = thesis_repo
        self._provider = market_provider

    def _get_current_price(self, symbol: str) -> Decimal:
        instrument = self._provider.instrument(symbol.upper())
        if instrument and instrument.price > 0:
            return instrument.price
        candles = self._provider.candles(symbol.upper(), "1d")
        if candles:
            return candles[-1].close
        return Decimal("30000")  # safe fallback if unlisted or mock

    def publish_thesis(
        self,
        user_id: str,
        author_name: str,
        symbol: str,
        stance: str,
        target_price: Decimal,
        stop_loss_price: Decimal,
        horizon_months: int,
        title: str,
        thesis_body: str,
        catalysts: tuple[str, ...],
    ) -> InvestmentThesis:
        sym = symbol.strip().upper()
        if not sym or len(sym) > 10:
            raise ThesisValidationError("Mã cổ phiếu không hợp lệ.")
        if stance not in ("bullish", "bearish", "neutral"):
            raise ThesisValidationError("Lập trường đầu tư phải là bullish, bearish hoặc neutral.")
        if horizon_months not in (1, 3, 6, 12):
            raise ThesisValidationError("Khung thời gian đầu tư phải là 1, 3, 6 hoặc 12 tháng.")
        if not title or len(title.strip()) < 5:
            raise ThesisValidationError("Tiêu đề luận điểm phải có ít nhất 5 ký tự.")
        if not thesis_body or len(thesis_body.strip()) < 20:
            raise ThesisValidationError("Nội dung phân tích luận điểm phải có ít nhất 20 ký tự.")

        # Anti-cheat: automatically snapshot current market price at time of publication
        entry_price = self._get_current_price(sym)

        if stance == "bullish":
            if target_price <= entry_price:
                raise ThesisValidationError(
                    f"Với lập trường Tăng giá (Bullish), giá mục tiêu ({target_price:,.0f} đ) "
                    f"phải cao hơn giá thị trường hiện tại ({entry_price:,.0f} đ)."
                )
            if stop_loss_price >= entry_price:
                raise ThesisValidationError(
                    f"Với lập trường Tăng giá (Bullish), giá cắt lỗ ({stop_loss_price:,.0f} đ) "
                    f"phải thấp hơn giá thị trường hiện tại ({entry_price:,.0f} đ)."
                )
        elif stance == "bearish":
            if target_price >= entry_price:
                raise ThesisValidationError(
                    f"Với lập trường Giảm giá (Bearish), giá mục tiêu ({target_price:,.0f} đ) "
                    f"phải thấp hơn giá thị trường hiện tại ({entry_price:,.0f} đ)."
                )
            if stop_loss_price <= entry_price:
                raise ThesisValidationError(
                    f"Với lập trường Giảm giá (Bearish), giá cắt lỗ ({stop_loss_price:,.0f} đ) "
                    f"phải cao hơn giá thị trường hiện tại ({entry_price:,.0f} đ)."
                )

        return self._repo.create(
            user_id=user_id,
            author_name=author_name,
            symbol=sym,
            stance=stance,
            entry_price=entry_price,
            target_price=target_price,
            stop_loss_price=stop_loss_price,
            horizon_months=horizon_months,
            title=title.strip(),
            thesis_body=thesis_body.strip(),
            catalysts=catalysts,
        )

    def list_theses(
        self,
        symbol: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
        sort: str = "engagement",
    ) -> list[dict[str, Any]]:
        theses = self._repo.list_all(
            symbol=symbol, status=status, limit=limit, offset=offset, sort=sort
        )
        result: list[dict[str, Any]] = []

        for item in theses:
            evaluated = self._evaluate_item(item)
            result.append(self._format_thesis(evaluated))

        return result

    def get_thesis(self, thesis_id: str) -> dict[str, Any] | None:
        item = self._repo.get_by_id(thesis_id)
        if not item:
            return None
        evaluated = self._evaluate_item(item)
        return self._format_thesis(evaluated)

    def upvote_thesis(self, thesis_id: str) -> int:
        return self._repo.upvote(thesis_id)

    def get_leaderboard(self, limit: int = 10) -> list[dict[str, Any]]:
        rows = self._repo.get_leaderboard(limit=limit)
        return [
            {
                "user_id": r.user_id,
                "author_name": r.author_name,
                "total_theses": r.total_theses,
                "active_theses": r.active_theses,
                "successful_theses": r.successful_theses,
                "stopped_theses": r.stopped_theses,
                "win_rate_percent": f"{r.win_rate_percent:.1f}%",
                "avg_roi_percent": f"{r.avg_roi_percent:+.1f}%",
                "rank_tier": r.rank_tier,
            }
            for r in rows
        ]

    def list_by_user(self, user_id: str) -> list[dict[str, Any]]:
        theses = self._repo.list_by_user(user_id)
        return [self._format_thesis(self._evaluate_item(t)) for t in theses]

    def _evaluate_item(self, item: InvestmentThesis) -> InvestmentThesis:
        if item.status != "active":
            return item

        current_price = self._get_current_price(item.symbol)

        if item.stance == "bullish":
            if current_price >= item.target_price:
                roi = ((item.target_price - item.entry_price) / item.entry_price) * Decimal("100")
                return self._repo.update_evaluation(
                    thesis_id=item.id,
                    status="hit_target",
                    outcome_roi=roi.quantize(Decimal("0.01")),
                    closed_price=current_price,
                )
            if current_price <= item.stop_loss_price:
                roi = ((item.stop_loss_price - item.entry_price) / item.entry_price) * Decimal(
                    "100"
                )
                return self._repo.update_evaluation(
                    thesis_id=item.id,
                    status="stopped_out",
                    outcome_roi=roi.quantize(Decimal("0.01")),
                    closed_price=current_price,
                )
        elif item.stance == "bearish":
            if current_price <= item.target_price:
                roi = ((item.entry_price - item.target_price) / item.entry_price) * Decimal("100")
                return self._repo.update_evaluation(
                    thesis_id=item.id,
                    status="hit_target",
                    outcome_roi=roi.quantize(Decimal("0.01")),
                    closed_price=current_price,
                )
            if current_price >= item.stop_loss_price:
                roi = ((item.entry_price - item.stop_loss_price) / item.entry_price) * Decimal(
                    "100"
                )
                return self._repo.update_evaluation(
                    thesis_id=item.id,
                    status="stopped_out",
                    outcome_roi=roi.quantize(Decimal("0.01")),
                    closed_price=current_price,
                )

        return item

    def _format_thesis(self, t: InvestmentThesis) -> dict[str, Any]:
        curr = self._get_current_price(t.symbol)
        # Calculate progress towards target
        if t.status == "active" and t.target_price != t.entry_price:
            prog = ((curr - t.entry_price) / (t.target_price - t.entry_price)) * Decimal("100")
            progress_pct = max(Decimal("0"), min(Decimal("100"), prog))
        elif t.status == "hit_target":
            progress_pct = Decimal("100")
        else:
            progress_pct = Decimal("0")

        return {
            "id": t.id,
            "user_id": t.user_id,
            "author_name": t.author_name,
            "symbol": t.symbol,
            "stance": t.stance,
            "entry_price": f"{t.entry_price:,.0f}",
            "target_price": f"{t.target_price:,.0f}",
            "stop_loss_price": f"{t.stop_loss_price:,.0f}",
            "current_price": f"{curr:,.0f}",
            "progress_percent": f"{progress_pct:.1f}",
            "horizon_months": t.horizon_months,
            "title": t.title,
            "thesis_body": t.thesis_body,
            "catalysts": list(t.catalysts),
            "status": t.status,
            "outcome_roi": f"{t.outcome_roi:+.1f}%" if t.outcome_roi is not None else None,
            "closed_at": t.closed_at.isoformat() if t.closed_at else None,
            "closed_price": f"{t.closed_price:,.0f}" if t.closed_price else None,
            "upvotes": t.upvotes,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat(),
        }
