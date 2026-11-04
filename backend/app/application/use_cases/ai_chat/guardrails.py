"""Input guardrails and output redaction for the AI financial assistant.

The assistant is read-only and public-data-only. These rules refuse requests that try to:
- extract secrets (tokens, keys, passwords, connection strings, environment configuration);
- modify the system (data, configuration, code, permissions, accounts, balances);
- read private data of users or internal operational data (user lists, emails, audit logs, schema);
- override the assistant's rules (prompt injection / jailbreak).

Matching runs on accent-folded, lower-cased text so Vietnamese with or without diacritics behaves
the same. Output redaction is a second line of defence for anything that reached the response text
(for example, an external snippet that happens to contain a credential).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Literal

GuardrailCategory = Literal[
    "secret_exfiltration",
    "system_modification",
    "private_user_data",
    "prompt_injection",
]


def fold_text(text: str) -> str:
    """Lower-case and strip Vietnamese diacritics (đ -> d) for robust phrase matching."""
    decomposed = unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", stripped).strip()


# Phrases are written already folded (no diacritics, lower case).
_SECRET_PHRASES: tuple[str, ...] = (
    "token",
    "api key",
    "apikey",
    "api_key",
    "secret",
    "mat khau",
    "password",
    "passwd",
    ".env",
    "bien moi truong",
    "environment variable",
    "jwt",
    "private key",
    "khoa bi mat",
    "khoa rieng tu",
    "credential",
    "thong tin dang nhap",
    "connection string",
    "chuoi ket noi",
    "database_url",
    "redis_url",
    "ssh key",
    "access key",
    "client secret",
    "cookie",
    "session id",
    "ma otp",
)

_SYSTEM_MODIFICATION_PHRASES: tuple[str, ...] = (
    "xoa database",
    "xoa co so du lieu",
    "xoa du lieu",
    "xoa bang",
    "drop table",
    "drop database",
    "delete from",
    "truncate",
    "update users",
    "insert into",
    "sua he thong",
    "thay doi he thong",
    "chinh sua he thong",
    "sua cau hinh",
    "thay doi cau hinh",
    "chinh cau hinh",
    "sua code",
    "sua ma nguon",
    "chinh sua du lieu",
    "sua du lieu",
    "chay lenh",
    "thuc thi lenh",
    "execute command",
    "run command",
    "rm -rf",
    "sudo ",
    "cap quyen admin",
    "nang quyen",
    "grant admin",
    "make me admin",
    "doi mat khau cua",
    "reset mat khau",
    "tat bao mat",
    "disable auth",
    "bypass",
    "vo hieu hoa",
    "restart server",
    "khoi dong lai server",
    "shutdown",
    "xoa tai khoan",
    "xoa nguoi dung",
    "cong tien vao",
    "nap tien vao tai khoan",
    "thay doi so du",
    "sua so du",
)

_PRIVATE_DATA_PHRASES: tuple[str, ...] = (
    "danh sach nguoi dung",
    "danh sach user",
    "danh sach tai khoan",
    "list users",
    "email cua nguoi dung",
    "email nguoi dung",
    "email cua user",
    "email user",
    "thong tin nguoi dung khac",
    "tai khoan nguoi khac",
    "tai khoan cua nguoi khac",
    "danh muc cua nguoi khac",
    "danh muc cua user",
    "so du cua user",
    "so du cua nguoi khac",
    "so dien thoai cua",
    "du lieu khach hang",
    "thong tin khach hang",
    "log he thong",
    "nhat ky he thong",
    "audit log",
    "bang users",
    "schema database",
    "cau truc database",
    "cau truc co so du lieu",
    "source code",
    "ma nguon",
)

_INJECTION_PHRASES: tuple[str, ...] = (
    "ignore previous",
    "ignore all previous",
    "ignore your instructions",
    "bo qua huong dan",
    "bo qua moi huong dan",
    "bo qua cac huong dan",
    "bo qua quy tac",
    "bo qua cac quy tac",
    "system prompt",
    "prompt he thong",
    "developer mode",
    "che do nha phat trien",
    "jailbreak",
    "dan mode",
    "act as admin",
    "gia vo la admin",
    "ban la admin",
    "tiet lo cau hinh",
)

_RULES: tuple[tuple[GuardrailCategory, tuple[str, ...]], ...] = (
    ("prompt_injection", _INJECTION_PHRASES),
    ("secret_exfiltration", _SECRET_PHRASES),
    ("system_modification", _SYSTEM_MODIFICATION_PHRASES),
    ("private_user_data", _PRIVATE_DATA_PHRASES),
)

_REFUSALS: dict[GuardrailCategory, str] = {
    "secret_exfiltration": (
        "Tôi không thể cung cấp hay tiết lộ bất kỳ thông tin bảo mật nào của hệ thống "
        "(token, khóa API, mật khẩu, chuỗi kết nối hay cấu hình môi trường)."
    ),
    "system_modification": (
        "Tôi là trợ lý chỉ-đọc và không nhận yêu cầu thay đổi hệ thống, dữ liệu, cấu hình, "
        "mã nguồn, quyền truy cập hay số dư tài khoản."
    ),
    "private_user_data": (
        "Tôi không thể truy xuất dữ liệu riêng tư của người dùng hoặc dữ liệu vận hành nội bộ "
        "của hệ thống (danh sách người dùng, email, nhật ký, cấu trúc cơ sở dữ liệu)."
    ),
    "prompt_injection": (
        "Tôi không thể bỏ qua các quy tắc an toàn đã được thiết lập cho trợ lý InvestIQ."
    ),
}

_REFUSAL_FOOTER = (
    "Tôi vẫn sẵn sàng hỗ trợ phân tích cổ phiếu, so sánh mã, kiểm tra rủi ro BCTC, "
    "diễn biến thị trường hoặc giải thích kiến thức đầu tư."
)


@dataclass(frozen=True)
class GuardrailVerdict:
    allowed: bool
    category: GuardrailCategory | None = None

    @property
    def refusal(self) -> str:
        if self.category is None:
            return ""
        return f"{_REFUSALS[self.category]}\n\n{_REFUSAL_FOOTER}"


def _contains_phrase(folded: str, phrase: str) -> bool:
    if not phrase[0].isalnum() or not phrase[-1].isalnum():
        return phrase in folded
    return re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", folded) is not None


def evaluate_guardrails(message: str) -> GuardrailVerdict:
    """Classify a user message; the first matching category wins."""
    folded = fold_text(message)
    for category, phrases in _RULES:
        if any(_contains_phrase(folded, phrase) for phrase in phrases):
            return GuardrailVerdict(allowed=False, category=category)
    return GuardrailVerdict(allowed=True)


_REDACTION_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}"),
        "[ĐÃ ẨN]",
    ),
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{12,}"), "Bearer [ĐÃ ẨN]"),
    (
        re.compile(r"\b(?:sk|pk|rk|ghp|gho|ghs|xox[abp])[-_][A-Za-z0-9_-]{12,}"),
        "[ĐÃ ẨN]",
    ),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[ĐÃ ẨN]"),
    (re.compile(r"\b([a-z][a-z0-9+.-]*://)[^\s:/@]+:[^\s@/]+@"), r"\1[ĐÃ ẨN]@"),
    (
        re.compile(
            r"(?i)\b(password|passwd|secret|api[_-]?key|access[_-]?key|token)(\s*[:=]\s*)\S+"
        ),
        r"\1\2[ĐÃ ẨN]",
    ),
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "[email đã ẩn]"),
    (re.compile(r"\b[a-fA-F0-9]{32,}\b"), "[ĐÃ ẨN]"),
)


def redact_sensitive_output(text: str) -> tuple[str, int]:
    """Mask credentials and personal identifiers; return the safe text and replacement count."""
    total = 0
    for pattern, replacement in _REDACTION_RULES:
        text, count = pattern.subn(replacement, text)
        total += count
    return text, total
