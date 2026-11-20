from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "kdp_studio_worker",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=[
        "app.tasks.research_tasks",
        "app.tasks.book_tasks",
        "app.tasks.export_tasks",
        "app.tasks.batch_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_default_retry_delay=15,
    task_routes={
        "app.tasks.research_tasks.*": {"queue": "research"},
        "app.tasks.book_tasks.*": {"queue": "generation"},
        "app.tasks.export_tasks.*": {"queue": "exports"},
        "app.tasks.batch_tasks.*": {"queue": "generation"},
    },
)
