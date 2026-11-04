"""Intent detection, Vietnamese input normalization, ticker extraction, and quantitative helpers."""

from __future__ import annotations

import contextlib
import re
from dataclasses import dataclass
from typing import Any, Literal

from app.application.use_cases.ai_chat.guardrails import fold_text

AiIntent = Literal[
    "blocked",
    "comparison",
    "dividend",
    "stock_analysis",
    "market_overview",
    "news",
    "knowledge",
    "external",
    "general",
]

# Known stock tickers regex: 3 uppercase letters
_TICKER_PATTERN = re.compile(r"\b([A-Z]{3})\b")

# Regex to detect tickers with explicit financial qualifiers, e.g. "mã TIN", "cổ phiếu HOM", "(HPG)"
_EXPLICIT_TICKER_PATTERN = re.compile(
    r"(?:mã|cổ phiếu|cp|ck|chứng khoán|định giá|phân tích|bctc)\s+([A-Z]{3})\b|"
    r"\b([A-Z]{3})\s+(?:tăng|giảm|trần|sàn|hôm nay|thế nào)\b|"
    r"\(([A-Z]{3})\)",
    re.IGNORECASE,
)

# Stop words that look like tickers but are Vietnamese words or common financial acronyms
_NON_TICKER_WORDS = frozenset(
    {
        "CHO", "CON", "CAC", "NAM", "THI", "GIA", "NEN", "MUA", "BAN", "XEM", "LUC",
        "QUA", "NAY", "VAY", "NHO", "LON", "TOC", "NGU", "GAP", "DCA", "BCTC", "EPS",
        "ROE", "ROA", "USD", "VND", "VSA", "MAC", "MAI", "DAO", "SAN", "COT", "DON",
        "TUC", "TRA", "DAN", "DOC", "BAI", "THE", "KHI", "BAO", "LAI", "COI", "HOI",
        "VON", "TIEN", "BOT", "HAY", "HOA", "LAM", "SAO", "VOI", "VAN", "GIO", "MAY",
        "DUY", "TAM", "BAT", "DAP", "CAN", "HAI", "BOM", "CAT", "DEN", "DEP", "DOI",
        "DOT", "GAY", "GHE", "HAT", "HEM", "HEN", "HOC", "HON", "HOP", "KEP", "KHO",
        "KYC", "LAN", "LAO", "LAP", "LAT", "LEP", "LOA", "LOT", "LUA", "LUN", "LUY",
        "MEO", "MUI", "MUN", "NEO", "NGA", "NGO", "NHA", "NHU", "NIT", "NON", "NUT",
        "ONG", "QUE", "QUI", "RAO", "ROT", "RUA", "RUT", "SAP", "SAT", "SAY", "SEN",
        "SET", "SOI", "SON", "SOT", "SUA", "SUC", "SUY", "TAI", "TAN", "TAP", "TAT",
        "TAY", "THA", "THO", "THU", "TIA", "TIE", "TIT", "TOA", "TON", "TRE", "TRI",
        "TRO", "TRU", "TUI", "TUT", "TUY", "UOC", "VIU", "VUI", "VUN", "XAM", "XAP",
        "XAU", "XAY", "XOA", "XOI", "XOM", "XON", "XOP", "XOT", "XUC",
        # Common conversational Vietnamese words & market index acronyms:
        "TIN", "HOM", "TAO", "DAY", "TOP", "MUC", "GOI", "MOI", "DAT", "LEN", "XEP",
        "LOI", "MAT", "TIM", "CAU", "CHON", "MO", "SUN", "TOI", "HNX", "VNI", "UPC",
        "GDP", "CPI", "FED", "ETF", "NAV", "RSI", "OBV", "SMA", "EMA", "ATR", "ADX",
        "VAI", "XIN", "NOI", "MOT", "NAO", "CUA", "SAU", "DAU", "CAO", "TOT", "GAN",
        "VUA", "KHA", "NHI", "LOC", "VAO", "BEN",
    }
)


@dataclass(frozen=True)
class DetectedIntent:
    normalized_message: str
    query_lower: str
    query_folded: str
    tickers: list[str]
    is_dividend: bool
    is_news: bool
    is_comparison: bool
    is_gold_bank: bool
    is_forensics: bool
    is_market_general: bool


def normalize_user_input(text: str) -> str:
    """Normalize user input by unsticking concatenated Vietnamese words and standardizing spacing."""
    if not text:
        return ""
    replacements = [
        ("khoánhôm", "khoán hôm"),
        ("khoanhom", "khoan hom"),
        ("tintức", "tin tức"),
        ("tintuc", "tin tuc"),
        ("cổtức", "cổ tức"),
        ("cotuc", "co tuc"),
        ("hômnay", "hôm nay"),
        ("homnay", "hom nay"),
        ("chứngkhoán", "chứng khoán"),
        ("chungkhoan", "chung khoan"),
        ("thịtrường", "thị trường"),
        ("thitruong", "thi truong"),
        ("cổphiếu", "cổ phiếu"),
        ("cophieu", "co phieu"),
        ("phântích", "phân tích"),
        ("phantich", "phan tich"),
        ("địnhgiá", "định giá"),
        ("dinhgia", "dinh gia"),
        ("biếnđộng", "biến động"),
        ("biendong", "bien dong"),
        ("thanhkhoản", "thanh khoản"),
        ("thanhkhoan", "thanh khoan"),
        ("khốingoại", "khối ngoại"),
        ("khoingoai", "khoi ngoai"),
        ("sôinổi", "sôi nổi"),
        ("soinoi", "soi noi"),
        ("sựkiện", "sự kiện"),
        ("sukien", "su kien"),
        ("sắptới", "sắp tới"),
        ("saptoi", "sap toi"),
    ]
    res = text
    for wrong, right in replacements:
        pattern = re.compile(re.escape(wrong), re.IGNORECASE)
        res = pattern.sub(right, res)
    return res


def normalize_question(message: str) -> str:
    """Canonical form used as the shared cache key: folded, punctuation-free, single-spaced."""
    normalized_msg = normalize_user_input(message)
    folded = fold_text(normalized_msg)
    cleaned = re.sub(r"[^a-z0-9/%\s]", " ", folded)
    return re.sub(r"\s+", " ", cleaned).strip()


def _extract_tickers(text: str) -> list[str]:
    found: list[str] = []
    # 1. Explicitly qualified tickers (e.g. "mã TIN", "cổ phiếu HOM", "(HPG)") take precedence
    for match in _EXPLICIT_TICKER_PATTERN.finditer(text):
        for group_idx in (1, 2, 3):
            token = match.group(group_idx)
            if token:
                token_upper = token.upper()
                if token_upper not in found:
                    found.append(token_upper)

    # 2. General uppercase 3-letter tokens, excluding common conversational stop words
    upper_text = text.upper()
    for match in _TICKER_PATTERN.finditer(upper_text):
        token = match.group(1)
        if token not in _NON_TICKER_WORDS and token not in found:
            found.append(token)
    return found


def _calculate_rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    gains = [d if d > 0 else 0.0 for d in deltas]
    losses = [-d if d < 0 else 0.0 for d in deltas]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(deltas)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 50.0 if avg_gain == 0 else 100.0
    rs = avg_gain / avg_loss
    return round(100.0 - (100.0 / (1.0 + rs)), 1)


def _clean_dividend_ratio(
    raw_ratio: str, div_type: str, cash_val: Any
) -> tuple[str, float | None]:
    """Extract a clean ratio token (e.g. '10%', '100:15', '10:1', '100:3') and infer cash value if applicable."""
    text = (raw_ratio or "").strip()
    inferred_cash = float(cash_val) if cash_val is not None else None

    # 1. Percentage pattern (e.g. 10%, 15.5%)
    pct_match = re.search(r"(\d+(?:[.,]\d+)?)\s*%", text)
    if pct_match:
        pct_str = pct_match.group(1).replace(",", ".")
        clean_r = f"{pct_str}%"
        if div_type == "cash" and inferred_cash is None:
            with contextlib.suppress(ValueError):
                inferred_cash = float(pct_str) * 100.0
        return clean_r, inferred_cash

    # 2. Colon ratio pattern (e.g. 10:1, 100:15, 100:3)
    colon_match = re.search(r"(\d+\s*:\s*\d+(?:[.,]\d+)?)", text)
    if colon_match:
        clean_r = re.sub(r"\s+", "", colon_match.group(1))
        if div_type == "cash" and inferred_cash is None:
            parts = clean_r.split(":")
            if len(parts) == 2:
                with contextlib.suppress(ValueError):
                    denom = float(parts[0])
                    numer = float(parts[1].replace(",", "."))
                    if denom > 0:
                        inferred_cash = (numer / denom) * 10000.0
        return clean_r, inferred_cash

    return (text or "Chưa công bố"), inferred_cash


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        if "data" in obj and isinstance(obj["data"], dict):
            val = obj["data"].get(key)
            if val is not None:
                return val
        return obj.get(key, default)
    return getattr(obj, key, default)


def detect_intent(user_message: str) -> DetectedIntent:
    """Analyze user message and classify primary financial/market intent."""
    norm_message = normalize_user_input(user_message)
    tickers = _extract_tickers(norm_message)
    query_lower = norm_message.lower()
    query_folded = fold_text(norm_message)

    is_dividend = any(
        kw in query_folded
        for kw in [
            "co tuc",
            "chia co tuc",
            "lich co tuc",
            "lich chia co tuc",
            "tra co tuc",
            "ngay chot quyen",
            "chot quyen",
            "gdkhq",
            "khong huong quyen",
            "ty le chia",
            "nhan co tuc",
            "chia thuong",
            "quyen mua",
            "tra bang tien",
            "tra bang co phieu",
            "su kien",
            "lich su kien",
            "su kien noi bat",
            "su kien sap toi",
            "su kien thi truong",
            "lich thi truong",
            "sap toi co",
            "dhcd",
            "dai hoi co dong",
            "hop co dong",
            "phat hanh them",
            "niem yet moi",
        ]
    )

    is_news = not is_dividend and any(
        kw in query_folded
        for kw in [
            "tin tuc",
            "tin moi",
            "ban tin",
            "tin nong",
            "diem tin",
            "tin thi truong",
            "tin chung khoan",
            "bao chi",
            "co tin gi",
            "tin hom nay",
            "tin trong ngay",
            "thoi su",
            "tong hop tin",
            "doc bao",
            "tin tuc moi",
            "tin dau tu",
            "tin tuc tai chinh",
            "cho tao tin",
            "cho toi tin",
            "cho xin tin",
            "co gi moi",
        ]
    )

    is_comparison = (
        not is_dividend
        and not is_news
        and any(kw in query_lower for kw in ["so sánh", "hay là", "vs", "hơn", "chọn mã nào"])
        and len(tickers) >= 2
    )
    is_gold_bank = any(
        kw in query_lower for kw in ["vàng", "ngân hàng", "tiết kiệm", "gửi tiền"]
    )
    is_forensics = (
        not is_dividend
        and not is_news
        and any(
            kw in query_lower
            for kw in [
                "gian lận",
                "bẫy",
                "báo cáo tài chính",
                "bctc",
                "nợ",
                "phải thu",
                "phá sản",
                "sức khỏe",
                "z-score",
                "altman",
            ]
        )
    )
    is_market_general = (
        not is_dividend
        and not is_news
        and not is_comparison
        and any(
            kw in query_folded
            for kw in [
                "thi truong",
                "vnindex",
                "vn-index",
                "vn30",
                "vn 30",
                "hnx",
                "upcom",
                "toan san",
                "nhip dap",
                "nganh nao",
                "nhom nganh",
                "bien dong",
                "tang manh",
                "tang nhieu",
                "tang tran",
                "tim tran",
                "giam manh",
                "giam nhieu",
                "giam sau",
                "nam san",
                "giam san",
                "thanh khoan",
                "giao dich nhieu",
                "soi dong",
                "soi noi",
                "hoat dong",
                "nhon nhip",
                "dang chu y",
                "noi bat hom nay",
                "co phieu trong",
                "ro vn30",
                "vai co phieu",
                "goi y co phieu",
                "khoi ngoai",
                "mua rong",
                "ban rong",
                "co phieu nao",
                "ma nao",
                "top co phieu",
                "hom nay mua gi",
                "xu huong hom nay",
            ]
        )
    )

    return DetectedIntent(
        normalized_message=norm_message,
        query_lower=query_lower,
        query_folded=query_folded,
        tickers=tickers,
        is_dividend=is_dividend,
        is_news=is_news,
        is_comparison=is_comparison,
        is_gold_bank=is_gold_bank,
        is_forensics=is_forensics,
        is_market_general=is_market_general,
    )
