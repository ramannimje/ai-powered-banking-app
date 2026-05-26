from celery import Celery
from celery.schedules import crontab

from core.config import settings

celery_app = Celery(
    "aisb_workers",
    broker=settings.CELERY_BROKER_URL,
    include=["workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    worker_prefetch_multiplier=4,
    worker_max_tasks_per_child=1000,
)

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "check-autonomous-rules": {
        "task": "workers.tasks.evaluate_all_rules",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },
    "check-fraud-anomalies": {
        "task": "workers.tasks.check_fraud_anomalies",
        "schedule": crontab(minute="*/1"),  # Every minute
    },
}


@celery_app.task(bind=True, name="workers.tasks.health_check")
def health_check(self):
    return {"status": "ok", "worker": "celery"}