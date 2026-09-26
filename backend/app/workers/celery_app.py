"""Celery configuration using Redis for task delivery and result storage."""

from celery import Celery
from celery.signals import setup_logging

from app.infrastructure.config.logging_config import configure_logging
from app.infrastructure.config.settings import settings

celery_app = Celery(
    "investiq",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)
celery_app.conf.update(
    accept_content=["json"],
    beat_schedule={},
    broker_connection_retry_on_startup=True,
    enable_utc=True,
    result_serializer="json",
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_serializer="json",
    timezone="Asia/Ho_Chi_Minh",
    worker_prefetch_multiplier=1,
)


def configure_worker_logging(**_: object) -> None:
    """Use the same sanitized JSON contract in worker and scheduler processes."""
    configure_logging()


setup_logging.connect(configure_worker_logging)
