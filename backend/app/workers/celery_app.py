"""Celery configuration using Redis for task delivery and result storage."""

from celery import Celery
from celery.signals import setup_logging

from app.infrastructure.config.logging_config import configure_logging
from app.infrastructure.config.settings import settings

celery_app = Celery(
    "investiq",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=("app.workers.news_ingestion_worker", "app.workers.auth_email_worker"),
)
celery_app.conf.update(
    accept_content=["json"],
    beat_schedule={
        "dispatch-auth-email-jobs": {
            "task": "investiq.auth.email.dispatch.v1",
            "schedule": 10.0,
            "options": {"queue": "notifications"},
        },
        **(
            {
                "discover-vietstock": {
                    "task": "investiq.news.discover.v1",
                    "schedule": 300.0,
                    "args": ("vietstock", 50),
                    "options": {"queue": "news-ingestion"},
                },
                "discover-cafef": {
                    "task": "investiq.news.discover.v1",
                    "schedule": 300.0,
                    "args": ("cafef", 50),
                    "options": {"queue": "news-ingestion"},
                },
                "discover-hnx": {
                    "task": "investiq.news.discover.v1",
                    "schedule": 300.0,
                    "args": ("hnx", 50),
                    "options": {"queue": "news-ingestion"},
                },
                "discover-vneconomy": {
                    "task": "investiq.news.discover.v1",
                    "schedule": 300.0,
                    "args": ("vneconomy", 50),
                    "options": {"queue": "news-ingestion"},
                },
                "discover-vnexpress": {
                    "task": "investiq.news.discover.v1",
                    "schedule": 300.0,
                    "args": ("vnexpress", 50),
                    "options": {"queue": "news-ingestion"},
                },
                "dispatch-persisted-news-jobs": {
                    "task": "investiq.news.dispatch.v1",
                    "schedule": 60.0,
                    "options": {"queue": "news-ingestion"},
                },
            }
            if settings.news_ingestion_enabled
            else {}
        ),
    },
    broker_connection_retry_on_startup=True,
    enable_utc=True,
    result_serializer="json",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_serializer="json",
    timezone="Asia/Ho_Chi_Minh",
    task_routes={
        "investiq.news.*": {"queue": "news-ingestion"},
        "investiq.auth.email.*": {"queue": "notifications"},
    },
    worker_prefetch_multiplier=1,
)


def configure_worker_logging(**_: object) -> None:
    """Use the same sanitized JSON contract in worker and scheduler processes."""
    configure_logging()


setup_logging.connect(configure_worker_logging)
