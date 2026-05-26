from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.models import User, Transaction, Account, SavingsVault
from core.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/spending")
async def get_spending_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    start_date = datetime.utcnow() - timedelta(days=days)

    acc_result = await db.execute(select(Account.id).where(Account.user_id == current_user.id))
    account_ids = [row[0] for row in acc_result.fetchall()]

    # Spending by category
    category_result = await db.execute(
        select(
            Transaction.category,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("count"),
        )
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.type.in_(["debit", "transfer_out"]),
            Transaction.created_at >= start_date,
        )
        .group_by(Transaction.category)
        .order_by(desc("total"))
    )

    categories = []
    for row in category_result:
        categories.append({
            "category": row[0] or "uncategorized",
            "total": float(row[1]),
            "count": row[2],
        })

    # Monthly trend
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    sixty_days_ago = datetime.utcnow() - timedelta(days=60)

    this_month = await db.execute(
        select(func.sum(Transaction.amount))
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.type.in_(["debit", "transfer_out"]),
            Transaction.created_at >= thirty_days_ago,
        )
    )
    last_month = await db.execute(
        select(func.sum(Transaction.amount))
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.type.in_(["debit", "transfer_out"]),
            Transaction.created_at >= sixty_days_ago,
            Transaction.created_at < thirty_days_ago,
        )
    )

    this_month_total = float(this_month.scalar() or 0)
    last_month_total = float(last_month.scalar() or 0)

    change_pct = ((this_month_total - last_month_total) / last_month_total * 100) if last_month_total > 0 else 0

    # Top merchants
    merchant_result = await db.execute(
        select(
            Transaction.merchant,
            func.sum(Transaction.amount).label("total"),
        )
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.type.in_(["debit", "transfer_out"]),
            Transaction.created_at >= start_date,
            Transaction.merchant != None,
        )
        .group_by(Transaction.merchant)
        .order_by(desc("total"))
        .limit(10)
    )

    top_merchants = [{"merchant": row[0], "total": float(row[1])} for row in merchant_result]

    # Income
    income_result = await db.execute(
        select(func.sum(Transaction.amount))
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.type == "credit",
            Transaction.created_at >= start_date,
        )
    )
    total_income = float(income_result.scalar() or 0)

    return {
        "period_days": days,
        "total_spending": this_month_total,
        "total_income": total_income,
        "month_over_month_change": round(change_pct, 1),
        "categories": categories,
        "top_merchants": top_merchants,
    }


@router.get("/summary")
async def get_summary(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    acc_result = await db.execute(select(Account).where(Account.user_id == current_user.id))
    accounts = acc_result.scalars().all()

    total_balance = sum(float(acc.balance) for acc in accounts)

    # Vaults
    vault_result = await db.execute(
        select(func.sum(SavingsVault.current_amount))
        .where(SavingsVault.user_id == current_user.id)
    )
    total_savings = float(vault_result.scalar() or 0)

    # Recent transactions
    account_ids = [acc.id for acc in accounts]
    txn_result = await db.execute(
        select(Transaction)
        .where(Transaction.account_id.in_(account_ids))
        .order_by(desc(Transaction.created_at))
        .limit(5)
    )
    recent_txns = txn_result.scalars().all()

    return {
        "total_balance": total_balance,
        "total_savings": total_savings,
        "accounts_count": len(accounts),
        "recent_transactions": [
            {
                "id": str(t.id),
                "type": t.type.value,
                "amount": float(t.amount),
                "category": t.category,
                "merchant": t.merchant,
                "created_at": t.created_at.isoformat(),
            }
            for t in recent_txns
        ],
    }