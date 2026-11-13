"""Ticker resolution, typo detection, closest match suggestion, and brand-to-ticker mapping.

Provides fuzzy resolution for mistyped stock tickers across Vietnamese financial contexts,
prioritizing highly liquid and benchmark VN30 / large-cap equities.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path

from app.application.use_cases.ai_chat.guardrails import fold_text

logger = logging.getLogger("investiq.ai_chat.ticker_resolver")

_RESOURCES_DIR = Path(__file__).resolve().parents[3] / "infrastructure" / "external" / "resources"
_SECTORS_FILE = _RESOURCES_DIR / "stock_sectors.json"


@dataclass(frozen=True)
class TickerSuggestion:
    symbol: str
    name: str
    sector: str
    similarity_score: float


# Top benchmark symbols for liquidity-weighted matching
_VN30_SET = frozenset(
    {
        "ACB",
        "BCM",
        "BID",
        "BVH",
        "CTG",
        "FPT",
        "GAS",
        "GVR",
        "HDB",
        "HPG",
        "MBB",
        "MSN",
        "MWG",
        "PLX",
        "POW",
        "SAB",
        "SHB",
        "SSB",
        "SSI",
        "STB",
        "TCB",
        "TPB",
        "VCB",
        "VHM",
        "VIB",
        "VIC",
        "VJC",
        "VNM",
        "VPB",
        "VRE",
    }
)

_MAJOR_SET = frozenset(
    {
        "DIG",
        "DXG",
        "PDR",
        "CEO",
        "NVL",
        "KBC",
        "VCI",
        "HCM",
        "VND",
        "SHS",
        "MBS",
        "CTS",
        "BSI",
        "DGC",
        "DCM",
        "DPM",
        "HSG",
        "NKG",
        "PVD",
        "PVS",
        "PVT",
        "VPI",
        "KDH",
        "GEX",
        "PC1",
        "REE",
        "VGC",
        "HAG",
        "HNG",
        "DBC",
        "BAF",
        "ANV",
        "VHC",
        "GMD",
        "HAH",
        "VOS",
        "BMP",
        "NTP",
        "HT1",
        "BSR",
        "OIL",
        "CTR",
        "VGI",
        "VTP",
        "FOX",
        "FRT",
        "DGW",
        "PNJ",
        "MSB",
        "LPB",
    }
)

# Curated company names for prominent listed entities
_TOP_COMPANY_NAMES: dict[str, str] = {
    "HPG": "Tập đoàn Hòa Phát",
    "VIC": "Tập đoàn Vingroup",
    "VHM": "CTCP Vinhomes",
    "VRE": "CTCP Vincom Retail",
    "VCB": "Ngân hàng Vietcombank",
    "TCB": "Ngân hàng Techcombank",
    "MBB": "Ngân hàng Quân Đội (MB Bank)",
    "VPB": "Ngân hàng VPBank",
    "ACB": "Ngân hàng ACB",
    "STB": "Ngân hàng Sacombank",
    "HDB": "Ngân hàng HDBank",
    "TPB": "Ngân hàng TPBank",
    "BID": "Ngân hàng BIDV",
    "CTG": "Ngân hàng VietinBank",
    "SHB": "Ngân hàng SHB",
    "SSB": "Ngân hàng SeABank",
    "VIB": "Ngân hàng VIB",
    "MSB": "Ngân hàng MSB",
    "LPB": "Ngân hàng LPBank",
    "FPT": "Tập đoàn FPT",
    "SSI": "CTCP Chứng khoán SSI",
    "VND": "CTCP Chứng khoán VNDIRECT",
    "VCI": "CTCP Chứng khoán Vietcap",
    "HCM": "CTCP Chứng khoán HSC",
    "SHS": "CTCP Chứng khoán Sài Gòn - Hà Nội",
    "MBS": "CTCP Chứng khoán MB",
    "VNM": "CTCP Sữa Việt Nam (Vinamilk)",
    "MSN": "Tập đoàn Masan",
    "MWG": "CTCP Đầu tư Thế Giới Di Động",
    "FRT": "CTCP Bán lẻ Kỹ thuật số FPT (Long Châu)",
    "DGW": "CTCP Thế Giới Số (Digiworld)",
    "PNJ": "CTCP Vàng bạc Đá quý Phú Nhuận",
    "SAB": "Tổng CTCP Bia - Rượu - Nước giải khát Sài Gòn (Sabeco)",
    "GAS": "Tổng Công ty Khí Việt Nam (PV Gas)",
    "PLX": "Tập đoàn Xăng dầu Việt Nam (Petrolimex)",
    "PVD": "Tổng CTCP Khoan và Dịch vụ Khoan Dầu khí (PV Drilling)",
    "PVS": "Tổng CTCP Dịch vụ Kỹ thuật Dầu khí Việt Nam (PTSC)",
    "BSR": "CTCP Lọc hóa dầu Bình Sơn",
    "OIL": "Tổng Công ty Dầu Việt Nam (PVOIL)",
    "POW": "Tổng Công ty Điện lực Dầu khí Việt Nam (PV Power)",
    "REE": "CTCP Cơ Điện Lạnh REE",
    "PC1": "CTCP Tập đoàn PC1",
    "GEX": "CTCP Tập đoàn GELEX",
    "HSG": "CTCP Tập đoàn Hoa Sen",
    "NKG": "CTCP Thép Nam Kim",
    "DGC": "CTCP Tập đoàn Hóa chất Đức Giang",
    "DCM": "CTCP Phân bón Dầu khí Cà Mau (Đạm Cà Mau)",
    "DPM": "Tổng Công ty Phân bón và Hóa chất Dầu khí (Đạm Phú Mỹ)",
    "NVL": "CTCP Tập đoàn Đầu tư Địa ốc No Va (Novaland)",
    "DIG": "Tổng CTCP Đầu tư Phát triển Xây dựng (DIC Corp)",
    "DXG": "CTCP Tập đoàn Đất Xanh",
    "PDR": "CTCP Phát triển Bất động sản Phát Đạt",
    "KDH": "CTCP Đầu tư và Kinh doanh Nhà Khang Điền",
    "KBC": "Tổng Công ty Phát triển Đô thị Kinh Bắc",
    "NLG": "CTCP Đầu tư Nam Long",
    "CEO": "CTCP Tập đoàn C.E.O",
    "VPI": "CTCP Đầu tư Văn Phú - Invest",
    "HAG": "CTCP Hoàng Anh Gia Lai",
    "HNG": "CTCP Nông nghiệp Quốc tế Hoàng Anh Gia Lai",
    "DBC": "CTCP Tập đoàn Dabaco Việt Nam",
    "BAF": "CTCP Nông nghiệp BAF Việt Nam",
    "ANV": "CTCP Nam Việt (Navico)",
    "VHC": "CTCP Vĩnh Hoàn",
    "GMD": "CTCP Gemadept",
    "HAH": "CTCP Vận tải và Xếp dỡ Hải An",
    "VOS": "CTCP Vận tải Biển Việt Nam",
    "VJC": "CTCP Hàng không Vietjet",
    "HVN": "Tổng Công ty Hàng không Việt Nam (Vietnam Airlines)",
    "BVH": "Tập đoàn Bảo Việt",
    "CTR": "Tổng Công ty CP Công trình Viettel (Viettel Construction)",
    "VGI": "Tổng Công ty CP Đầu tư Quốc tế Viettel (Viettel Global)",
    "VTP": "Tổng Công ty CP Bưu chính Viettel (Viettel Post)",
    "HPB": "CTCP Bao bì Hải Phòng",
}

# Mapping popular brand / company names in conversational Vietnamese to stock symbols
_BRAND_TO_TICKER: tuple[tuple[str, str], ...] = (
    ("hoa phat", "HPG"),
    ("thep hoa phat", "HPG"),
    ("tap doan hoa phat", "HPG"),
    ("vinamilk", "VNM"),
    ("sua vinamilk", "VNM"),
    ("vingroup", "VIC"),
    ("tap doan vingroup", "VIC"),
    ("vinhomes", "VHM"),
    ("vincom retail", "VRE"),
    ("vincom", "VRE"),
    ("the gioi di dong", "MWG"),
    ("bach hoa xanh", "MWG"),
    ("dien may xanh", "MWG"),
    ("fpt telecom", "FOX"),
    ("fpt retail", "FRT"),
    ("nha thuoc long chau", "FRT"),
    ("long chau", "FRT"),
    ("fpt", "FPT"),
    ("vietcombank", "VCB"),
    ("techcombank", "TCB"),
    ("mb bank", "MBB"),
    ("mbbank", "MBB"),
    ("ngan hang quan doi", "MBB"),
    ("vpbank", "VPB"),
    ("sacombank", "STB"),
    ("vietinbank", "CTG"),
    ("bidv", "BID"),
    ("acb", "ACB"),
    ("hdbank", "HDB"),
    ("tpbank", "TPB"),
    ("shb", "SHB"),
    ("seabank", "SSB"),
    ("vib", "VIB"),
    ("msb", "MSB"),
    ("lpbank", "LPB"),
    ("chungkhoan ssi", "SSI"),
    ("ssi", "SSI"),
    ("vndirect", "VND"),
    ("vietcap", "VCI"),
    ("hoa sen", "HSG"),
    ("thep hoa sen", "HSG"),
    ("nam kim", "NKG"),
    ("thep nam kim", "NKG"),
    ("novaland", "NVL"),
    ("dat xanh", "DXG"),
    ("phat dat", "PDR"),
    ("khang dien", "KDH"),
    ("kinh bac", "KBC"),
    ("nam long", "NLG"),
    ("ceo group", "CEO"),
    ("duc giang", "DGC"),
    ("hoa chat duc giang", "DGC"),
    ("dam ca mau", "DCM"),
    ("dam phu my", "DPM"),
    ("pv gas", "GAS"),
    ("petrolimex", "PLX"),
    ("pv drilling", "PVD"),
    ("khoan dau khi", "PVD"),
    ("ptsc", "PVS"),
    ("loc hoa dau binh son", "BSR"),
    ("pv power", "POW"),
    ("dien luc dau khi", "POW"),
    ("masan", "MSN"),
    ("tap doan masan", "MSN"),
    ("sabeco", "SAB"),
    ("bia sai gon", "SAB"),
    ("vietjet", "VJC"),
    ("vietjet air", "VJC"),
    ("vietnam airlines", "HVN"),
    ("bao viet", "BVH"),
    ("hoang anh gia lai", "HAG"),
    ("hagl", "HAG"),
    ("nong nghiep quoc te", "HNG"),
    ("dabaco", "DBC"),
    ("gelex", "GEX"),
    ("co dien lanh", "REE"),
    ("viettel post", "VTP"),
    ("viettel construction", "CTR"),
)


def _load_sectors() -> dict[str, str]:
    if not _SECTORS_FILE.exists():
        logger.warning("stock_sectors_file_missing_at_%s", _SECTORS_FILE)
        return {}
    try:
        with open(_SECTORS_FILE, encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return {str(k).upper(): str(v) for k, v in data.items()}
    except Exception as exc:
        logger.warning("failed_loading_stock_sectors: %s", exc)
    return {}


_SECTORS: dict[str, str] = _load_sectors()


def _levenshtein(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return _levenshtein(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev[j + 1] + 1
            deletions = curr[j] + 1
            substitutions = prev[j] + (c1 != c2)
            curr.append(min(insertions, deletions, substitutions))
        prev = curr
    return prev[-1]


def is_valid_ticker(symbol: str) -> bool:
    """Check if the uppercase symbol is a recognized listed stock ticker."""
    sym = symbol.strip().upper()
    return sym in _SECTORS or sym in _TOP_COMPANY_NAMES


def get_company_name(symbol: str) -> str:
    """Retrieve full friendly company name or fallback to ticker label."""
    sym = symbol.strip().upper()
    if sym in _TOP_COMPANY_NAMES:
        return _TOP_COMPANY_NAMES[sym]
    return f"Cổ phiếu {sym}"


def get_stock_sector(symbol: str) -> str:
    """Retrieve sector category for symbol."""
    sym = symbol.strip().upper()
    return _SECTORS.get(sym, "Niêm yết")


def resolve_brand_to_ticker(query: str) -> str | None:
    """Resolve Vietnamese brand or conversational company name to ticker symbol."""
    folded = fold_text(query).lower()
    for brand_key, ticker in _BRAND_TO_TICKER:
        if brand_key in folded:
            return ticker
    return None


def find_closest_tickers(
    raw_token: str,
    max_results: int = 3,
    *,
    allow_valid: bool = False,
) -> list[TickerSuggestion]:
    """Find the closest valid stock tickers to a mistyped user token.

    Weights results by edit distance, liquidity tier (VN30 / Major stocks),
    and common Vietnamese keyboard / phonetic confusions (e.g. B vs P).
    """
    token = raw_token.strip().upper()
    if not token or len(token) < 2 or len(token) > 4:
        return []

    # If the token itself is valid and allow_valid is False, no suggestion needed
    if not allow_valid and is_valid_ticker(token):
        return []

    scored: list[tuple[float, str]] = []
    token_len = len(token)

    for sym in _SECTORS:
        if sym == token:
            continue
        sym_len = len(sym)
        if abs(token_len - sym_len) > 1:
            continue

        dist = _levenshtein(token, sym)
        if dist > 1:
            continue

        # Base score starts high and drops with edit distance
        score = 100.0 - dist * 30.0

        # Liquidity & prominence tier bonuses
        if sym in _VN30_SET:
            score += 25.0
        elif sym in _MAJOR_SET:
            score += 15.0

        # Phonetic / typing confusion bonuses in Vietnamese
        # 1. 'B' and 'P' confusion (e.g. HBG -> HPG, HPB -> HPG)
        if ("B" in token and "P" in sym) or ("P" in token and "B" in sym):
            score += 12.0

        # 2. 'G' and 'K' / 'C' confusion
        if ("G" in token and "K" in sym) or ("C" in token and "K" in sym):
            score += 6.0

        # 3. First character match bonus (users rarely get the first letter wrong)
        if token[0] == sym[0]:
            score += 8.0

        # 4. Exact prefix or suffix match (e.g. VICC -> VIC, TCBB -> TCB, FPTT -> FPT)
        if sym in token or token in sym:
            score += 15.0

        scored.append((score, sym))

    scored.sort(key=lambda x: -x[0])

    results: list[TickerSuggestion] = []
    seen: set[str] = set()
    for sc, sym in scored:
        if sym not in seen:
            seen.add(sym)
            results.append(
                TickerSuggestion(
                    symbol=sym,
                    name=get_company_name(sym),
                    sector=get_stock_sector(sym),
                    similarity_score=round(sc, 1),
                )
            )
            if len(results) >= max_results:
                break

    return results


_EXTRA_STOP_WORDS = frozenset(
    {
        "ATC",
        "ATO",
        "PLO",
        "MP",
        "LO",
        "MTL",
        "MOK",
        "MAK",
        "VN30",
        "HOSE",
        "HNX",
        "UPCOM",
        "VNINDEX",
        "VANG",
        "NGAN",
        "HANG",
        "TIET",
        "KIEM",
        "TRAI",
        "PHIEU",
        "TANG",
        "GIAM",
        "TRAN",
        "SAN",
        "HOM",
        "NAY",
        "THE",
        "NAO",
        "MANH",
        "NHAT",
        "TRONG",
        "RO",
        "LA",
        "GI",
        "VA",
        "VOI",
        "SO",
        "SANH",
        "DOI",
        "CHIEU",
        "GIUA",
        "CUA",
        "SAP",
        "TOI",
        "MOI",
        "TIN",
        "TUC",
        "LICH",
        "CHIA",
        "CO",
        "MA",
        "CP",
        "CK",
        "DINH",
        "PHAN",
        "TICH",
        "RUI",
        "BAO",
        "CAO",
        "TAI",
        "CHINH",
        "THEO",
        "THONG",
        "CA",
        "HAI",
        "TOAN",
        "DIEN",
        "TRUONG",
    }
)


def extract_tickers_with_typo_handling(
    text: str,
    stop_words: frozenset[str],
) -> tuple[list[str], list[str]]:
    """Extract recognized stock tickers and isolate mistyped ticker tokens.

    Returns:
        tuple of (valid_tickers, invalid_tickers)
    """
    valid: list[str] = []
    invalid: list[str] = []
    combined_stop = stop_words | _EXTRA_STOP_WORDS

    def _add_token(raw_tok: str) -> None:
        tok = raw_tok.strip().upper()
        if not tok or len(tok) < 2 or len(tok) > 5:
            return
        if tok in combined_stop:
            return
        if is_valid_ticker(tok):
            if tok not in valid:
                valid.append(tok)
        elif tok not in invalid and tok not in valid and find_closest_tickers(tok):
            invalid.append(tok)

    # 1. Check brand / company names first
    folded_lower = fold_text(text).lower()
    for brand_key, mapped_sym in _BRAND_TO_TICKER:
        if mapped_sym not in valid and re.search(rf"\b{re.escape(brand_key)}\b", folded_lower):
            valid.append(mapped_sym)

    # 2. Comparison regex: e.g. "so sánh HBG và HPB", "đối chiếu VICC với HPG"
    comp_pat = re.compile(
        r"(?:so sánh|đối chiếu|giữa)\s+([A-Za-z0-9]{2,5})\s+(?:và|với|va|voi)\s+([A-Za-z0-9]{2,5})\b",
        re.IGNORECASE,
    )
    for m in comp_pat.finditer(text):
        for g in (1, 2):
            _add_token(m.group(g))

    # 3. Explicit keywords: e.g. "mã VICC", "cổ phiếu HBG", "định giá TCBB", "phân tích HBG", "mua 300 HPPG"
    explicit_pat = re.compile(
        r"(?:mã|cổ phiếu|cp|ck|chứng khoán|định giá|phân tích|bctc|cổ tức|rủi ro)\s+([A-Za-z0-9]{2,5})\b|"
        r"(?:mua|bán|ban|lệnh|gom|múc|muc|xả|xa|khớp|khop|đặt|dat)\s+(?:thêm\s+|them\s+|tiếp\s+|tiep\s+|giúp\s+|giup\s+|hộ\s+|ho\s+|dùm\s+|dum\s+|ngay\s+|luôn\s+|luon\s+|bớt\s+|bot\s+|hết\s+|het\s+)?(?:\d{1,7}\s*(?:co|cp|co phieu|shares)?\s+)?([A-Za-z0-9]{2,5})\b|"
        r"\b(?:\d{1,7})\s*(?:co|cp|co phieu|shares)\s+([A-Za-z0-9]{2,5})\b|"
        r"\b([A-Za-z0-9]{2,5})\s+(?:\d{1,7})\s*(?:co|cp|co phieu|shares)\b|"
        r"\b([A-Za-z0-9]{2,5})\s+(?:tăng|giảm|trần|sàn|hôm nay|thế nào)\b|"
        r"\(([A-Za-z0-9]{2,5})\)",
        re.IGNORECASE,
    )
    for m in explicit_pat.finditer(text):
        for g in range(1, 7):
            tok = m.group(g)
            if tok:
                _add_token(tok)

    # 4. General tokens in uppercase text (3-4 letters e.g. HPG, HPPG, FPTT)
    ticker_pat = re.compile(r"\b([A-Z]{3,4})\b")
    for m in ticker_pat.finditer(text):
        _add_token(m.group(1))

    return valid, invalid
