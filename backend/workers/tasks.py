"""
Celery tasks for autonomous finance agent and background jobs.
"""
import structlog
from datetime import datetime

logger = structlog.get_logger()

from celery import shared_task


@shared_task(name="workers.tasks.evaluate_all_rules")
def evaluate_all_rules():
    """
    Evaluate all active autonomous rules for all users.
    Runs every 5 minutes via Celery Beat.
    """
    logger.info("evaluating_autonomous_rules_start")

    try:
        from core.database import SyncSessionLocal
        from core.models import AutonomousRule, User
        from services.autonomous import evaluate_rule_trigger, execute_rule_action

        with SyncSessionLocal() as db:
            # Get all active rules
            rules = db.query(AutonomousRule).filter(AutonomousRule.is_active == True).all()

            triggered_count = 0
            for rule in rules:
                try:
                    user = db.query(User).filter(User.id == rule.user_id).first()
                    if not user or not user.is_active:
                        continue

                    triggered, reason = evaluate_rule_trigger(rule, user, db)

                    if triggered:
                        result = execute_rule_action(rule, user, db)
                        rule.last_triggered_at = datetime.utcnow()
                        rule.trigger_count += 1
                        rule.last_execution_log = result
                        logger.info("rule_triggered", rule_id=str(rule.id), rule_name=rule.name, amount=result.get("amount"))
                        triggered_count += 1
                    else:
                        logger.debug("rule_not_triggered", rule_id=str(rule.id), reason=reason)

                    db.commit()
                except Exception as e:
                    logger.error("rule_evaluation_error", rule_id=str(rule.id), error=str(e))
                    db.rollback()

        logger.info("autonomous_rules_evaluation_complete", total_rules=len(rules), triggered=triggered_count)
        return {"rules_evaluated": len(rules), "triggered": triggered_count}

    except Exception as e:
        logger.error("autonomous_rules_worker_error", error=str(e))
        return {"error": str(e)}


@shared_task(name="workers.tasks.check_fraud_anomalies")
def check_fraud_anomalies():
    """
    Run spending anomaly scan for all users every minute.
    """
    logger.info("fraud_anomaly_check_start")

    try:
        from core.database import SyncSessionLocal
        from core.models import User

        with SyncSessionLocal() as db:
            users = db.query(User).filter(User.is_active == True).all()

            anomalies_found = 0
            for user in users:
                try:
                    from services.fraud import scan_anomalies_for_user
                    result = scan_anomalies_for_user(user, db)
                    anomalies_found += result.get("count", 0)
                except Exception as e:
                    logger.error("fraud_scan_user_error", user_id=str(user.id), error=str(e))

        logger.info("fraud_anomaly_check_complete", users=len(users), anomalies=anomalies_found)
        return {"users_scanned": len(users), "anomalies_found": anomalies_found}

    except Exception as e:
        logger.error("fraud_anomaly_worker_error", error=str(e))
        return {"error": str(e)}


@shared_task(name="workers.tasks.run_all_autonomous_rules")
def run_all_autonomous_rules():
    """
    Dedicated task for running all rules — can be triggered manually too.
    """
    return evaluate_all_rules()


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