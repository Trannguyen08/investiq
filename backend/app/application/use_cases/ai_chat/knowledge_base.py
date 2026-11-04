"""Retrieval over InvestIQ's curated, published learning content.

This is the assistant's "memorized" system knowledge: glossary terms and lesson summaries that
admins have published. Draft content and any user data are never indexed. The index is rebuilt
after a bounded refresh interval so admin edits become visible without a restart.
"""

from __future__ import annotations

import re
import threading
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Literal

from app.application.interfaces.i_knowledge_source import KnowledgeSource
from app.application.use_cases.ai_chat.guardrails import fold_text

KnowledgeKind = Literal["glossary", "topic"]

_REFRESH_SECONDS = 600.0
_MIN_TOPIC_SCORE = 2.0
_TOKEN_PATTERN = re.compile(r"[a-z0-9/]+")

# Folded Vietnamese function words that carry no topical meaning.
_STOPWORDS = frozenset(
    {
        "la", "gi", "cua", "va", "co", "cho", "toi", "ban", "nhu", "the", "nao", "khong",
        "mot", "cac", "nhung", "duoc", "trong", "voi", "ve", "khi", "thi", "de", "hay",
        "hoi", "giai", "thich", "y", "nghia", "sao", "bao", "nhieu", "lam",
        "minh", "em", "anh", "chi", "a", "oi", "nhe", "vay", "tai",
    }
)


@dataclass(frozen=True)
class KnowledgeEntry:
    kind: KnowledgeKind
    title: str
    text: str
    topic_title: str
    topic_slug: str
    aliases: tuple[str, ...]
    tokens: frozenset[str]


@dataclass(frozen=True)
class KnowledgeHit:
    entry: KnowledgeEntry
    score: float


def _tokens(folded: str) -> frozenset[str]:
    return frozenset(
        token
        for token in _TOKEN_PATTERN.findall(folded)
        if len(token) >= 2 and token not in _STOPWORDS
    )


def _term_aliases(term: str) -> tuple[str, ...]:
    """'Cổ tức (Dividend)' -> ('co tuc (dividend)', 'co tuc', 'dividend')."""
    folded = fold_text(term)
    aliases = {folded}
    head = folded.split("(", 1)[0].strip()
    if head:
        aliases.add(head)
    for inner in re.findall(r"\(([^)]+)\)", folded):
        if inner.strip():
            aliases.add(inner.strip())
    return tuple(sorted(aliases, key=len, reverse=True))


def _alias_in(folded_query: str, alias: str) -> bool:
    return re.search(rf"(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])", folded_query) is not None


def _as_str(value: object) -> str:
    return value if isinstance(value, str) else ""


def _build_entries(topics: list[Mapping[str, object]]) -> list[KnowledgeEntry]:
    entries: list[KnowledgeEntry] = []
    for topic in topics:
        if topic.get("status") != "published":
            continue
        topic_title = _as_str(topic.get("title"))
        topic_slug = _as_str(topic.get("slug"))
        summary = _as_str(topic.get("summary"))
        if topic_title:
            folded_title = fold_text(topic_title)
            entries.append(
                KnowledgeEntry(
                    kind="topic",
                    title=topic_title,
                    text=summary,
                    topic_title=topic_title,
                    topic_slug=topic_slug,
                    aliases=(),
                    tokens=_tokens(f"{folded_title} {fold_text(summary)}"),
                )
            )
        glossary = topic.get("glossary")
        if not isinstance(glossary, list):
            continue
        for item in glossary:
            if not isinstance(item, Mapping):
                continue
            term = _as_str(item.get("term"))
            definition = _as_str(item.get("definition"))
            if not term or not definition:
                continue
            entries.append(
                KnowledgeEntry(
                    kind="glossary",
                    title=term,
                    text=definition,
                    topic_title=topic_title,
                    topic_slug=topic_slug,
                    aliases=_term_aliases(term),
                    tokens=_tokens(fold_text(term)),
                )
            )
    return entries


class InternalKnowledgeBase:
    def __init__(
        self,
        source: KnowledgeSource,
        clock: Callable[[], float] = time.monotonic,
        refresh_seconds: float = _REFRESH_SECONDS,
    ) -> None:
        self._source = source
        self._clock = clock
        self._refresh_seconds = refresh_seconds
        self._lock = threading.Lock()
        self._entries: list[KnowledgeEntry] = []
        self._loaded_at: float | None = None

    def _ensure_index(self) -> list[KnowledgeEntry]:
        now = self._clock()
        with self._lock:
            if self._loaded_at is not None and now - self._loaded_at < self._refresh_seconds:
                return self._entries
        topics = [dict(topic) for topic in self._source.get_topics(status="published")]
        entries = _build_entries(topics)
        with self._lock:
            self._entries = entries
            self._loaded_at = now
        return entries

    def search(self, query: str, limit: int = 3) -> list[KnowledgeHit]:
        folded_query = fold_text(query)
        query_tokens = _tokens(folded_query)
        hits: list[KnowledgeHit] = []
        for entry in self._ensure_index():
            if entry.kind == "glossary":
                if any(_alias_in(folded_query, alias) for alias in entry.aliases):
                    hits.append(KnowledgeHit(entry=entry, score=10.0 + len(entry.aliases[0])))
                continue
            overlap = len(query_tokens & entry.tokens)
            if overlap >= _MIN_TOPIC_SCORE:
                hits.append(KnowledgeHit(entry=entry, score=float(overlap)))
        hits.sort(key=lambda hit: hit.score, reverse=True)
        return hits[:limit]
