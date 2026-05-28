from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Literal
from uuid import UUID

from core.database import get_db
from core.models import User, Transaction, Account, Notification, Card, TransactionType
from core.models_ai import SpendingAnomaly
from core.auth import get_current_user

router = APIRouter(prefix="/fraud", tags=["Fraud"])


# ─── Real-time Transaction Check ──────────────────────────────
@router.post("/check")
async def check_transaction(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check a transaction for fraud and auto-block if needed."""
    account_id = data.get("account_id")
    amount = float(data.get("amount", 0))
    merchant = data.get("merchant", "")
    category = data.get("category", "")

    alerts = []
    is_blocked = False

    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        return {"alerts": [], "blocked": False}

    # Rule 1: Large transaction
    if amount > 100000:
        alerts.append(f"Very large transaction: ₹{amount:,.2f}")
        is_blocked = True
    elif amount > 50000:
        alerts.append(f"Large transaction: ₹{amount:,.2f} at {merchant}")
        is_blocked = True

    # Rule 2: Unusual time (between 1AM - 5AM local)
    hour = datetime.utcnow().hour
    if 1 <= hour <= 5:
        alerts.append(f"Unusual time transaction: {hour}:00 hours")
        is_blocked = True

    # Rule 3: Multiple transactions in short span
    five_mins_ago = datetime.utcnow() - timedelta(minutes=5)
    count_result = await db.execute(
        select(func.count()).where(
            Transaction.account_id == account_id,
            Transaction.created_at >= five_mins_ago,
        )
    )
    if count_result.scalar() >= 5:
        alerts.append("Multiple rapid transactions (5+ in 5 minutes)")
        is_blocked = True

    # Rule 4: New merchant (first time seen, high value)
    if amount > 15000:
        merchant_check = await db.execute(
            select(Transaction.merchant)
            .where(Transaction.account_id == account_id, Transaction.merchant == merchant)
            .limit(1)
        )
        if not merchant_check.scalar_one_or_none():
            alerts.append(f"New merchant '{merchant}' — ₹{amount:,.2f} first-time transaction")

    # Rule 5: Unusual category for user
    if category:
        cat_total_result = await db.execute(
            select(func.sum(Transaction.amount))
            .where(
                Transaction.account_id == account_id,
                Transaction.category == category,
                Transaction.created_at >= datetime.utcnow() - timedelta(days=30),
            )
        )
        monthly_cat_total = float(cat_total_result.scalar() or 0)
        if monthly_cat_total > 0 and amount > monthly_cat_total * 2:
            alerts.append(f"Amount (₹{amount:,.2f}) is 2x your monthly average for {category}")

    # Rule 6: Balance check
    if account.balance < Decimal(str(amount)):
        alerts.append("Insufficient account balance")

    # Create fraud notification if needed
    if is_blocked or alerts:
        notification = Notification(
            user_id=current_user.id,
            type="fraud_alert",
            title="Transaction Alert" if alerts and not is_blocked else "Transaction Blocked",
            body=f"{'Blocked: ' if is_blocked else ''}₹{amount:,.2f} at {merchant}. " + ("; ".join(alerts) if alerts else "Review needed"),
            metadata={"alerts": alerts, "amount": amount, "merchant": merchant, "blocked": is_blocked},
        )
        db.add(notification)
        await db.flush()

    return {
        "alerts": alerts,
        "blocked": is_blocked,
        "reason": "; ".join(alerts) if alerts else "Transaction looks normal",
    }


# ─── Fraud Alerts ─────────────────────────────────────────────
@router.get("/alerts")
async def get_fraud_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all fraud alerts with pagination."""
    query = (
        select(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.type == "fraud_alert",
        )
        .order_by(desc(Notification.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    alerts = result.scalars().all()

    count = (await db.execute(
        select(func.count()).where(
            Notification.user_id == current_user.id,
            Notification.type == "fraud_alert",
        )
    )).scalar()

    return {
        "items": [
            {
                "id": str(a.id),
                "title": a.title,
                "body": a.body,
                "is_read": a.is_read,
                "metadata": a.metadata,
                "created_at": a.created_at.isoformat(),
            }
            for a in alerts
        ],
        "total": count,
        "page": page,
        "page_size": page_size,
    }


# ─── Spending Anomaly Scan ─────────────────────────────────────
@router.post("/scan-anomalies")
async def scan_anomalies(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run anomaly detection on user's recent transactions. Called on-demand or by Celery."""
    acc_result = await db.execute(select(Account.id).where(Account.user_id == current_user.id))
    account_ids = [row[0] for row in acc_result.fetchall()]

    if not account_ids:
        return {"anomalies_detected": 0, "alerts": []}

    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    new_anomalies = []

    # 1. Category spending spikes (this week vs last 4 weeks avg)
    cat_result = await db.execute(
        select(
            Transaction.category,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.type.in_(["debit", "transfer_out"]),
            Transaction.created_at >= thirty_days_ago,
        )
        .group_by(Transaction.category)
    )

    for row in cat_result.fetchall():
        category = row[0] or "uncategorized"
        total_amount = float(row[1])
        weekly_avg = total_amount / 4

        # This week's spending in this category
        this_week_result = await db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.account_id.in_(account_ids),
                Transaction.category == category,
                Transaction.type.in_(["debit", "transfer_out"]),
                Transaction.created_at >= seven_days_ago,
            )
        )
        this_week = float(this_week_result.scalar() or 0)

        if weekly_avg > 500 and this_week > weekly_avg * 1.5:
            pct_above = round((this_week / weekly_avg - 1) * 100, 1)
            # Check if we already have this anomaly recent
            existing = await db.execute(
                select(SpendingAnomaly).where(
                    SpendingAnomaly.user_id == current_user.id,
                    SpendingAnomaly.category == category,
                    SpendingAnomaly.anomaly_type == "spike",
                    SpendingAnomaly.created_at >= seven_days_ago,
                    SpendingAnomaly.is_resolved == False,
                )
            )
            if not existing.scalar_one_or_none():
                anomaly = SpendingAnomaly(
                    user_id=current_user.id,
                    anomaly_type="spike",
                    severity="high" if pct_above > 100 else "medium",
                    category=category,
                    description=f"Spending on {category} is {pct_above}% above your weekly average. This week: ₹{this_week:,.2f} vs avg ₹{weekly_avg:,.2f}/week",
                    detected_amount=this_week,
                    baseline_amount=weekly_avg,
                    threshold_pct=pct_above,
                )
                db.add(anomaly)
                new_anomalies.append(anomaly)

    # 2. New recurring transactions detected
    recurring_result = await db.execute(
        select(
            Transaction.merchant,
            func.count(Transaction.id).label("count"),
            func.sum(Transaction.amount).label("total"),
        )
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.merchant != None,
            Transaction.created_at >= seven_days_ago,
        )
        .group_by(Transaction.merchant)
        .having(func.count(Transaction.id) >= 3)
    )

    for row in recurring_result.fetchall():
        merchant = row[0]
        count = row[1]
        total = float(row[2])

        # Check if this is truly new (not in last month)
        old_result = await db.execute(
            select(func.count()).where(
                Transaction.account_id.in_(account_ids),
                Transaction.merchant == merchant,
                Transaction.created_at < thirty_days_ago,
            )
        )
        if old_result.scalar() == 0:
            existing = await db.execute(
                select(SpendingAnomaly).where(
                    SpendingAnomaly.user_id == current_user.id,
                    SpendingAnomaly.anomaly_type == "new_recurring",
                    SpendingAnomaly.metadata["merchant"].astext == merchant,
                    SpendingAnomaly.is_resolved == False,
                )
            )
            if not existing.scalar_one_or_none():
                anomaly = SpendingAnomaly(
                    user_id=current_user.id,
                    anomaly_type="new_recurring",
                    severity="low",
                    description=f"New recurring charge detected: '{merchant}' — {count} times in 7 days totalling ₹{total:,.2f}",
                    detected_amount=total,
                    metadata={"merchant": merchant, "count": count},
                )
                db.add(anomaly)
                new_anomalies.append(anomaly)

    await db.flush()

    return {
        "anomalies_detected": len(new_anomalies),
        "alerts": [
            {
                "id": str(a.id),
                "type": a.anomaly_type,
                "severity": a.severity,
                "category": a.category,
                "description": a.description,
                "created_at": a.created_at.isoformat(),
            }
            for a in new_anomalies
        ],
    }


# ─── Security Settings ────────────────────────────────────────
@router.get("/security-dashboard")
async def security_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Summary of fraud detection status and recent activity."""
    acc_result = await db.execute(select(Account.id).where(Account.user_id == current_user.id))
    account_ids = [row[0] for row in acc_result.fetchall()]

    # Recent fraud alerts
    alerts_result = await db.execute(
        select(func.count()).where(
            Notification.user_id == current_user.id,
            Notification.type == "fraud_alert",
            Notification.created_at >= datetime.utcnow() - timedelta(days=7),
        )
    )
    week_alerts = alerts_result.scalar()

    # Active anomalies
    anomaly_result = await db.execute(
        select(func.count()).where(
            SpendingAnomaly.user_id == current_user.id,
            SpendingAnomaly.is_resolved == False,
            SpendingAnomaly.created_at >= datetime.utcnow() - timedelta(days=30),
        )
    )
    active_anomalies = anomaly_result.scalar()

    # Transactions this week
    txn_result = await db.execute(
        select(func.count()).where(
            Transaction.account_id.in_(account_ids),
            Transaction.created_at >= datetime.utcnow() - timedelta(days=7),
        )
    )
    week_txns = txn_result.scalar()

    # Unusual time transactions
    unusual_result = await db.execute(
        select(func.count()).where(
            Transaction.account_id.in_(account_ids),
            Transaction.created_at >= datetime.utcnow() - timedelta(days=7),
        )
    )

    return {
        "week_alerts": week_alerts,
        "active_anomalies": active_anomalies,
        "transactions_this_week": week_txns,
        "security_score": max(0, 100 - (week_alerts * 10) - (active_anomalies * 5)),
        "status": "protected" if active_anomalies == 0 else "attention_needed",
    }