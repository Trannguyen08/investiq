"""Intent detection, Vietnamese input normalization, ticker extraction, and quantitative helpers."""

from __future__ import annotations

import contextlib
import re
from dataclasses import dataclass
from typing import Any, Literal

from app.application.use_cases.ai_chat.guardrails import fold_text
from app.application.use_cases.ai_chat.ticker_resolver import (
    _EXTRA_STOP_WORDS,
    extract_tickers_with_typo_handling,
    is_valid_ticker,
)

AiIntent = Literal[
    "blocked",
    "trade_order",
    "community_post",
    "comparison",
    "dividend",
    "stock_analysis",
    "market_overview",
    "leader",
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
        "VUA", "KHA", "NHI", "LOC", "VAO", "BEN", "CHU",
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
    is_trade_order: bool = False
    trade_side: str | None = None  # "buy" or "sell"
    trade_quantity: int | None = None
    trade_symbol: str | None = None
    is_community_post: bool = False
    community_symbol: str | None = None
    is_leader: bool = False
    leader_id: str | None = None
    leader_name: str | None = None
    is_leader_rankings: bool = False
    is_ecosystem: bool = False
    ecosystem_id: str | None = None
    comparison_mode: str | None = None
    comparison_exceeded_limit: bool = False
    invalid_tickers: tuple[str, ...] = ()


# Map of known entrepreneur and market leader aliases: (aliases, leader_id, leader_name, default_symbols)
_LEADER_ALIASES: tuple[tuple[tuple[str, ...], str, str, tuple[str, ...]], ...] = (
    (
        (
            "pham nhat vuong",
            "nhat vuong",
            "ong vuong",
            "vuong vin",
            "chu tich vingroup",
            "chu tich vinfast",
            "chu tich vic",
            "chu tich vhm",
            "ty phu vuong",
            "sang lap vin",
            "ong chu vingroup",
            "vingroup la ai",
            "he sinh thai vingroup",
            "he sinh thai vin",
            "he sinh thai pham nhat vuong",
            "su nghiep pham nhat vuong",
            "su nghiep cua pham nhat vuong",
            "tap doan vingroup",
            "cong ty vingroup",
        ),
        "person-1",
        "Phạm Nhật Vượng",
        ("VIC", "VHM"),
    ),
    (
        (
            "tran dinh long",
            "dinh long",
            "ong long",
            "long hoa phat",
            "chu tich hoa phat",
            "chu tich hpg",
            "vua thep",
            "ty phu tran dinh long",
            "ong chu hoa phat",
            "hoa phat la ai",
            "he sinh thai hoa phat",
            "he sinh thai tran dinh long",
            "su nghiep tran dinh long",
            "su nghiep cua tran dinh long",
            "tap doan hoa phat",
            "thep hoa phat",
        ),
        "person-2",
        "Trần Đình Long",
        ("HPG",),
    ),
    (
        (
            "nguyen thi phuong thao",
            "phuong thao",
            "ba thao",
            "thao vietjet",
            "chu tich vietjet",
            "chu tich vjc",
            "pho chu tich hdbank",
            "nu ty phu",
            "ty phu nguyen thi phuong thao",
            "vietjet la ai",
            "sovico la ai",
            "he sinh thai vietjet",
            "he sinh thai sovico",
            "he sinh thai hdbank",
            "he sinh thai nguyen thi phuong thao",
            "su nghiep nguyen thi phuong thao",
            "tap doan sovico",
        ),
        "person-3",
        "Nguyễn Thị Phương Thảo",
        ("VJC", "HDB"),
    ),
    (
        ("do anh tuan", "anh tuan sunshine", "chu tich sunshine", "chu tich ksfinance"),
        "person-4",
        "Đỗ Anh Tuấn",
        ("KSF", "SSH"),
    ),
    (
        (
            "ho hung anh",
            "hung anh techcombank",
            "chu tich techcombank",
            "chu tich tcb",
            "techcombank la ai",
            "he sinh thai techcombank",
            "he sinh thai ho hung anh",
            "su nghiep ho hung anh",
            "ngan hang techcombank",
        ),
        "person-5",
        "Hồ Hùng Anh",
        ("TCB", "MSN"),
    ),
    (
        (
            "nguyen dang quang",
            "dang quang",
            "quang masan",
            "chu tich masan",
            "chu tich msn",
            "masan la ai",
            "he sinh thai masan",
            "he sinh thai nguyen dang quang",
            "su nghiep nguyen dang quang",
            "tap doan masan",
        ),
        "person-6",
        "Nguyễn Đăng Quang",
        ("MSN", "TCB"),
    ),
    (
        (
            "truong gia binh",
            "gia binh",
            "ong binh",
            "binh fpt",
            "chu tich fpt",
            "sang lap fpt",
            "fpt la ai",
            "tap doan fpt",
            "he sinh thai fpt",
            "he sinh thai truong gia binh",
            "su nghiep truong gia binh",
            "su nghiep cua truong gia binh",
        ),
        "person-7",
        "Trương Gia Bình",
        ("FPT", "FOX"),
    ),
    (
        (
            "bui thanh nhon",
            "thanh nhon",
            "nhon novaland",
            "chu tich novaland",
            "chu tich nvl",
            "novaland la ai",
            "he sinh thai novaland",
            "he sinh thai bui thanh nhon",
            "tap doan novaland",
        ),
        "person-8",
        "Bùi Thành Nhơn",
        ("NVL",),
    ),
    (
        (
            "nguyen duc tai",
            "duc tai",
            "tai the gioi di dong",
            "tai mwg",
            "chu tich the gioi di dong",
            "chu tich mwg",
            "the gioi di dong la ai",
            "mwg la ai",
            "he sinh thai the gioi di dong",
            "he sinh thai mwg",
            "he sinh thai nguyen duc tai",
        ),
        "person-9",
        "Nguyễn Đức Tài",
        ("MWG",),
    ),
    (
        ("dang thanh tam", "thanh tam", "tam kbc", "chu tich kinh bac", "chu tich kbc", "kinh bac la ai"),
        "person-10",
        "Đặng Thành Tâm",
        ("KBC", "SGT"),
    ),
    (
        ("nguyen van dat", "van dat", "dat phat dat", "dat pdr", "chu tich phat dat", "chu tich pdr", "phat dat la ai"),
        "person-11",
        "Nguyễn Văn Đạt",
        ("PDR",),
    ),
    (
        (
            "doan nguyen duc",
            "nguyen duc",
            "bau duc",
            "ong duc",
            "duc hagl",
            "chu tich hagl",
            "chu tich hoang anh gia lai",
            "hagl la ai",
            "hoang anh gia lai la ai",
            "he sinh thai hagl",
            "he sinh thai bau duc",
            "su nghiep bau duc",
        ),
        "person-12",
        "Đoàn Nguyên Đức (Bầu Đức)",
        ("HAG", "HNG"),
    ),
    (
        ("ho xuan nang", "xuan nang", "nang do thai", "chu tich vicostone", "chu tich phenikaa"),
        "person-13",
        "Hồ Xuân Năng (Năng Do Thái)",
        ("VCS",),
    ),
    (
        (
            "nguyen duy hung",
            "duy hung",
            "hung ssi",
            "chu tich ssi",
            "chu tich pan",
            "ssi la ai",
            "pan group la ai",
            "he sinh thai ssi",
            "he sinh thai pan",
            "he sinh thai nguyen duy hung",
        ),
        "person-14",
        "Nguyễn Duy Hưng",
        ("SSI", "PAN"),
    ),
    (
        ("dang van thanh", "van thanh", "thanh ttc", "chu tich ttc"),
        "person-15",
        "Đặng Văn Thành",
        ("SBT", "GEG"),
    ),
    (
        ("nguyen thi mai thanh", "mai thanh ree", "ba thanh ree", "chu tich ree"),
        "person-16",
        "Nguyễn Thị Mai Thanh",
        ("REE",),
    ),
    (
        ("le viet hai", "viet hai", "hai hoa binh", "hai hbc", "chu tich hoa binh", "chu tich hbc"),
        "person-17",
        "Lê Viết Hải",
        ("HBC",),
    ),
    (
        ("johnathan hanh nguyen", "hanh nguyen", "vua hang hieu", "chu tich ippg", "chu tich sasco"),
        "person-18",
        "Johnathan Hạnh Nguyễn",
        ("SAS",),
    ),
    (
        ("truong anh tuan", "tuan hoang quan", "tuan hqc", "chu tich hoang quan", "chu tich hqc"),
        "person-19",
        "Trương Anh Tuấn",
        ("HQC",),
    ),
    (
        ("dao hong tuyen", "hong tuyen", "chua dao tuan chau", "ong tuyen tuan chau", "chu tich tuan chau"),
        "person-20",
        "Đào Hồng Tuyển",
        (),
    ),
    (
        ("nguyen canh son", "canh son", "chu tich eurowindow"),
        "person-21",
        "Nguyễn Cảnh Sơn",
        ("TCB",),
    ),
    (
        ("huynh uy dung", "uy dung", "dung lo voi", "ong dung lo voi", "chu tich dai nam"),
        "person-22",
        "Huỳnh Uy Dũng (Dũng Lò Vôi)",
        (),
    ),
    # International financial legends
    (
        ("warren buffett", "buffett", "nha tien tri omaha", "chu tich berkshire", "berkshire hathaway"),
        "global-1",
        "Warren Buffett",
        (),
    ),
    (
        ("charlie munger", "munger"),
        "global-2",
        "Charlie Munger",
        (),
    ),
    (
        ("peter lynch",),
        "global-3",
        "Peter Lynch",
        (),
    ),
    (
        ("george soros", "soros"),
        "global-4",
        "George Soros",
        (),
    ),
    (
        ("elon musk", "musk", "ceo tesla"),
        "global-5",
        "Elon Musk",
        (),
    ),
)


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
        ("doanhnhân", "doanh nhân"),
        ("doanhnhan", "doanh nhan"),
        ("chủtịch", "chủ tịch"),
        ("chutich", "chu tich"),
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
    valid_resolved, invalid_resolved = extract_tickers_with_typo_handling(
        norm_message, _NON_TICKER_WORDS
    )
    for sym in valid_resolved:
        if sym not in tickers:
            tickers.append(sym)
    for sym in invalid_resolved:
        if sym not in tickers:
            tickers.append(sym)
    query_lower = norm_message.lower()
    query_folded = fold_text(norm_message)

    # 0. Trade order detection (e.g. "mua giúp tao 300 cổ mbb", "đặt mua 1000 fpt", "bán 500 hpg")
    is_trade_analysis_query = any(
        kw in query_folded
        for kw in [
            "co nen mua",
            "co nen ban",
            "nen mua khong",
            "nen ban khong",
            "nen mua hay",
            "nen ban hay",
            "diem mua",
            "diem ban",
            "vung mua",
            "vung ban",
            "khuyen nghi mua",
            "khuyen nghi ban",
            "tu van mua",
            "tu van ban",
            "co mua duoc",
            "co ban duoc",
            "chieu mua",
            "chieu ban",
            "mua gia nao",
            "ban gia nao",
            "phan tich",
            "danh gia",
            "nhan dinh",
            "xu huong",
            "the nao",
            "tiem nang",
            "co tot khong",
        ]
    )

    is_trade_order = False
    trade_side: str | None = None
    trade_quantity: int | None = None
    trade_symbol: str | None = None

    if not is_trade_analysis_query:
        qty_match = re.search(
            r"\b(\d{1,7})\s*(?:co|cp|co phieu|shares)?\b",
            query_folded,
        )
        found_qty = int(qty_match.group(1)) if qty_match else None

        buy_actions = [
            "mua",
            "dat mua",
            "mua them",
            "mua tiep",
            "mua giup",
            "mua ho",
            "mua dum",
            "mua cho",
            "gom",
            "muc",
            "vao lenh mua",
            "lenh mua",
            "mua vao",
            "gia lap mua",
            "mua ngay",
            "mua luon",
        ]
        sell_actions = [
            "ban",
            "dat ban",
            "ban them",
            "ban bot",
            "ban tiep",
            "ban giup",
            "ban ho",
            "ban dum",
            "ban cho",
            "ban ra",
            "ban het",
            "xa",
            "chot loi",
            "cat lo",
            "vao lenh ban",
            "lenh ban",
            "gia lap ban",
            "ban ngay",
            "ban luon",
        ]

        has_buy = any(re.search(r"\b" + re.escape(w) + r"\b", query_folded) for w in buy_actions)
        has_sell = any(re.search(r"\b" + re.escape(w) + r"\b", query_folded) for w in sell_actions)

        # Check explicit patterns: "mua/bán [thêm/giúp/...] [qty] [symbol]" or "mua/bán [thêm/...] [symbol] [qty]"
        direct_order_match = re.search(
            r"\b(mua|ban)(?:\s+(?:them|tiep|giup|ho|dum|cho|ngay|luon|bot|ra|vao|het))?\s+(\d{1,7})\s*(?:co|cp|co phieu|shares)?\s+([a-z0-9]{2,5})\b",
            query_folded,
        ) or re.search(
            r"\b(mua|ban)(?:\s+(?:them|tiep|giup|ho|dum|cho|ngay|luon|bot|ra|vao|het))?\s+([a-z0-9]{2,5})\s+(\d{1,7})\s*(?:co|cp|co phieu|shares)?\b",
            query_folded,
        )

        if direct_order_match:
            action_word = direct_order_match.group(1).lower()
            val1 = direct_order_match.group(2)
            val2 = direct_order_match.group(3)
            parsed_sym = (val2 if val1.isdigit() else val1).upper()
            parsed_qty = int(val1 if val1.isdigit() else val2)

            if parsed_sym in _NON_TICKER_WORDS or parsed_sym in _EXTRA_STOP_WORDS:
                parsed_sym = tickers[0] if tickers else None

            if parsed_sym:
                is_trade_order = True
                trade_side = "sell" if "ban" in action_word else "buy"
                trade_quantity = parsed_qty
                trade_symbol = parsed_sym

                if is_valid_ticker(parsed_sym):
                    if parsed_sym not in tickers:
                        tickers.insert(0, parsed_sym)
                else:
                    if parsed_sym not in invalid_resolved:
                        invalid_resolved.append(parsed_sym)
        elif (has_buy or has_sell) and (tickers or invalid_resolved):
            is_trade_order = True
            trade_side = "sell" if has_sell else "buy"
            trade_quantity = found_qty if (found_qty and found_qty > 0) else 100
            trade_symbol = tickers[0] if tickers else invalid_resolved[0]
        elif (
            ("mua" in query_folded or "ban" in query_folded)
            and found_qty
            and (tickers or invalid_resolved)
            and any(
                w in query_folded
                for w in ["giup", "ho", "dum", "tao", "toi", "minh", "dat", "lenh", "them", "tiep", "bot", "luon"]
            )
        ):
            is_trade_order = True
            trade_side = "sell" if "ban" in query_folded else "buy"
            trade_quantity = found_qty
            trade_symbol = tickers[0] if tickers else invalid_resolved[0]

    # 0.1 Community post / thesis draft detection
    is_community_post = any(
        kw in query_folded
        for kw in [
            "dang bai",
            "viet bai",
            "tao bai",
            "tao luan diem",
            "dang luan diem",
            "viet luan diem",
            "chia se luan diem",
            "dang len cong dong",
            "chia se len cong dong",
            "dang bai giup",
            "viet bai giup",
            "soan bai",
            "soan luan diem",
            "dang bai ve",
            "viet bai ve",
            "tao bai ve",
        ]
    )
    community_symbol = tickers[0] if (is_community_post and tickers) else None

    is_dividend = (
        not is_trade_order
        and not is_community_post
        and any(
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
    ))

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

    is_criteria_followup = (
        len(tickers) == 0
        and not is_dividend
        and not is_news
        and query_folded.strip()
        in [
            "thong so",
            "theo thong so",
            "ve thong so",
            "bao cao tang truong",
            "tang truong",
            "theo bao cao tang truong",
            "ve tang truong",
            "ca hai",
            "ca 2",
            "toan dien",
            "ca hai tieu chi",
        ]
    )

    is_comparison = (
        not is_dividend
        and not is_news
        and (
            (
                any(
                    kw in query_folded
                    for kw in [
                        "so sanh",
                        "so voi",
                        "hay la",
                        " vs ",
                        "vs.",
                        " hon ",
                        "chon ma nao",
                        "doi dau",
                        "giua hai",
                        "giua 2",
                        "giua 3",
                    ]
                )
                and len(tickers) >= 2
            )
            or is_criteria_followup
        )
    )

    comparison_mode: str | None = None
    comparison_exceeded_limit = False

    if is_comparison:
        if len(tickers) > 2:
            comparison_exceeded_limit = True
            tickers = tickers[:2]

        if any(
            kw in query_folded
            for kw in [
                "ca hai",
                "ca 2",
                "tat ca",
                "toan dien",
                "day du",
                "ca thong so va tang truong",
                "ca hai tieu chi",
                "ca hai mat",
            ]
        ):
            comparison_mode = "both"
        elif any(
            kw in query_folded
            for kw in [
                "bao cao tang truong",
                "tang truong",
                "growth",
                "doanh thu",
                "loi nhuan",
                "kqkd",
                "ket qua kinh doanh",
                "theo bao cao tang truong",
                "ve mat tang truong",
            ]
        ):
            comparison_mode = "growth"
        elif any(
            kw in query_folded
            for kw in [
                "thong so",
                "chi so",
                "dinh gia",
                "p/e",
                "p/b",
                "roe",
                "co ban",
                "ky thuat",
                "theo thong so",
                "ve mat thong so",
            ]
        ):
            comparison_mode = "metrics"
        else:
            comparison_mode = "ask"
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

    # Leader / Entrepreneur / Ecosystem intent detection
    is_leader = False
    leader_id: str | None = None
    leader_name: str | None = None
    is_leader_rankings = False
    is_ecosystem = any(
        kw in query_folded
        for kw in [
            "he sinh thai",
            "chuoi gia tri",
            "cong ty con",
            "cong ty me",
            "cac cong ty thanh vien",
            "he thong doanh nghiep",
            "tap doan va cac cong ty",
        ]
    )
    ecosystem_id: str | None = None

    if is_ecosystem:
        is_leader = True
        if any(w in query_folded for w in ["vin", "vic", "vhm", "vre", "vuong"]):
            ecosystem_id = "vingroup"
            leader_id = "person-1"
            leader_name = "Phạm Nhật Vượng"
            if not tickers:
                tickers = ["VIC", "VHM", "VRE"]
        elif any(w in query_folded for w in ["hoa phat", "hpg", "dinh long"]):
            ecosystem_id = "hoaphat"
            leader_id = "person-2"
            leader_name = "Trần Đình Long"
            if not tickers:
                tickers = ["HPG"]
        elif any(w in query_folded for w in ["fpt", "fox", "frt", "gia binh"]):
            ecosystem_id = "fpt"
            leader_id = "person-7"
            leader_name = "Trương Gia Bình"
            if not tickers:
                tickers = ["FPT", "FOX", "FRT"]
        elif any(w in query_folded for w in ["masan", "techcombank", "msn", "tcb", "dang quang", "hung anh"]):
            ecosystem_id = "masan-techcombank"
            leader_id = "person-6"
            leader_name = "Nguyễn Đăng Quang & Hồ Hùng Anh"
            if not tickers:
                tickers = ["MSN", "TCB", "MCH"]
        elif any(w in query_folded for w in ["vietjet", "sovico", "hdbank", "vjc", "hdb", "phuong thao"]):
            ecosystem_id = "sovico"
            leader_id = "person-3"
            leader_name = "Nguyễn Thị Phương Thảo"
            if not tickers:
                tickers = ["VJC", "HDB"]
        elif any(w in query_folded for w in ["ssi", "pan", "duy hung"]):
            ecosystem_id = "ssi-pan"
            leader_id = "person-14"
            leader_name = "Nguyễn Duy Hưng"
            if not tickers:
                tickers = ["SSI", "PAN"]

    # 1. Check general rankings / billionaires list
    if not is_ecosystem and any(
        kw in query_folded
        for kw in [
            "top nguoi giau",
            "danh sach ty phu",
            "dai gia chung khoan",
            "doanh nhan noi bat",
            "nhung nguoi giau nhat",
            "xep hang nguoi giau",
            "top doanh nhan",
            "cac ty phu",
            "tai san cac ty phu",
            "nguoi giau nhat viet nam",
            "top dai gia",
            "dai gia san chung khoan",
            "nhung ty phu",
            "danh sach nguoi giau",
        ]
    ):
        is_leader = True
        is_leader_rankings = True

    # 2. Check alias matches for specific leaders
    if not is_leader_rankings and not ecosystem_id:
        for aliases, lid, lname, def_syms in _LEADER_ALIASES:
            if any(alias in query_folded for alias in aliases):
                is_leader = True
                leader_id = lid
                leader_name = lname
                if def_syms and (not tickers or not any(s in tickers for s in def_syms)):
                    tickers = list(def_syms)
                break

    # 3. Check generic leadership / entrepreneur question patterns ("... là ai", "chủ tịch ...", "doanh nhân ...")
    if (
        not is_leader
        and not is_dividend
        and not is_news
        and not any(
            kw in query_folded for kw in ["thi truong la", "vnindex la", "vn30 la", "co phieu la gi"]
        )
        and any(
            kw in query_folded
            for kw in [
                "doanh nhan",
                "chu tich",
                "tong giam doc",
                "ban lanh dao",
                "la ai",
                "ong la ai",
                "ba la ai",
                "ai la chu tich",
                "ai la ceo",
                "tai san cua",
                "tieu su",
                "su nghiep",
                "con duong su nghiep",
                "tap doan",
                "doanh nghiep",
            ]
        )
    ):
        is_leader = True
        is_leader_rankings = any(kw in query_folded for kw in ["danh sach", "cac", "nhung", "top"])

    is_market_general = (
        not is_dividend
        and not is_news
        and not is_comparison
        and not is_leader
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

    active_invalid = (
        () if (is_leader or is_news or is_market_general) else tuple(invalid_resolved)
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
        is_trade_order=is_trade_order,
        trade_side=trade_side,
        trade_quantity=trade_quantity,
        trade_symbol=trade_symbol,
        is_community_post=is_community_post,
        community_symbol=community_symbol,
        is_leader=is_leader,
        leader_id=leader_id,
        leader_name=leader_name,
        is_leader_rankings=is_leader_rankings,
        is_ecosystem=is_ecosystem,
        ecosystem_id=ecosystem_id,
        comparison_mode=comparison_mode,
        comparison_exceeded_limit=comparison_exceeded_limit,
        invalid_tickers=active_invalid,
    )
