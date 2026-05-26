"""
Celery tasks for autonomous finance agent and background jobs.
"""
import structlog

logger = structlog.get_logger()

from celery import shared_task
from datetime import datetime, timedelta
from decimal import Decimal

# Import after app init
from workers.celery_app import celery_app


@shared_task(name="workers.tasks.evaluate_all_rules")
def evaluate_all_rules():
    """
    Evaluate all active autonomous rules for all users.
    This is triggered every 5 minutes by Celery Beat.
    """
    logger.info("Evaluating autonomous rules")
    # TODO: Load all active rules from DB, evaluate triggers, execute actions
    return {"rules_evaluated": 0}


@shared_task(name="workers.tasks.check_fraud_anomalies")
def check_fraud_anomalies():
    """
    Background fraud monitoring task.
    Runs every minute to check for anomalies.
    """
    logger.info("Running fraud anomaly check")
    return {"alerts_generated": 0}


@shared_task(name="workers.tasks.send_notification")
def send_notification(user_id: str, notif_type: str, title: str, body: str, metadata: dict = None):
    """Send a notification to a user."""
    from core.database import SyncSessionLocal
    from core.models import Notification

    with SyncSessionLocal() as db:
        notification = Notification(
            user_id=user_id,
            type=notif_type,
            title=title,
            body=body,
            metadata=metadata or {},
        )
        db.add(notification)
        db.commit()

    logger.info("notification_sent", user_id=user_id, type=notif_type)
    return {"notification_id": str(notification.id)}