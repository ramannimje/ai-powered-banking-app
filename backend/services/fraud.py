from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.models import User, Transaction, Account, Notification, Card
from core.auth import get_current_user

router = APIRouter(prefix="/fraud", tags=["Fraud"])


@router.post("/check")
async def check_transaction(data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Check a transaction for fraud and auto-block if needed."""
    account_id = data.get("account_id")
    amount = float(data.get("amount", 0))
    merchant = data.get("merchant", "")

    alerts = []
    is_blocked = False

    # Get account
    result = await db.execute(select(Account).where(Account.id == account_id, Account.user_id == current_user.id))
    account = result.scalar_one_or_none()
    if not account:
        return {"alerts": [], "blocked": False}

    # Rule 1: Large transaction
    if amount > 50000:
        alerts.append(f"Large transaction detected: ₹{amount:,.2f} at {merchant}")
        is_blocked = True

    # Rule 2: Unusual time (between 1AM - 5AM)
    hour = datetime.utcnow().hour
    if 1 <= hour <= 5:
        alerts.append(f"Unusual transaction time: {hour}:00 hours")
        is_blocked = True

    # Rule 3: Multiple transactions in short span
    five_mins_ago = datetime.utcnow() - timedelta(minutes=5)
    recent_count = await db.execute(
        select(func.count())
        .where(
            Transaction.account_id == account_id,
            Transaction.created_at >= five_mins_ago,
        )
    )
    if recent_count.scalar() >= 3:
        alerts.append("Multiple rapid transactions detected (3+ in 5 minutes)")
        is_blocked = True

    # Rule 4: New merchant
    distinct_merchants = await db.execute(
        select(func.count(func.distinct(Transaction.merchant)))
        .where(Transaction.account_id == account_id, Transaction.merchant != None)
    )
    if distinct_merchants.scalar() > 0:
        # Check if this merchant is new
        merchant_check = await db.execute(
            select(Transaction)
            .where(Transaction.account_id == account_id, Transaction.merchant == merchant)
            .order_by(desc(Transaction.created_at))
            .limit(1)
        )
        if not merchant_check.scalar_one_or_none() and amount > 10000:
            alerts.append(f"New merchant '{merchant}' with ₹{amount:,.2f} transaction")
            is_blocked = True

    # Create fraud notification if needed
    if is_blocked:
        notification = Notification(
            user_id=current_user.id,
            type="fraud_alert",
            title="Transaction Blocked",
            body=f"Your transaction of ₹{amount:,.2f} at {merchant} was blocked due to: {'; '.join(alerts)}",
            metadata={"alerts": alerts, "amount": amount, "merchant": merchant},
        )
        db.add(notification)
        await db.flush()

    return {
        "alerts": alerts,
        "blocked": is_blocked,
        "reason": "; ".join(alerts) if alerts else "Transaction looks normal",
    }


@router.get("/alerts")
async def get_fraud_alerts(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification)
        .where(
            Notification.user_id == current_user.id,
            Notification.type == "fraud_alert",
        )
        .order_by(desc(Notification.created_at))
        .limit(20)
    )
    alerts = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "title": a.title,
            "body": a.body,
            "is_read": a.is_read,
            "created_at": a.created_at.isoformat(),
        }
        for a in alerts
    ]