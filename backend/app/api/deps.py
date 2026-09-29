"""FastAPI dependency composition."""

from collections.abc import Iterator

from app.domain.repositories.i_news_repository import INewsRepository
from app.infrastructure.db.repositories.sql_news_repository import SqlNewsRepository
from app.infrastructure.db.session import get_pool


def get_news_repository() -> Iterator[INewsRepository]:
    yield SqlNewsRepository(get_pool())
