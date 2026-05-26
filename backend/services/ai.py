from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.models import User, Transaction, Account
from core.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/chat")
async def chat(message: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user_msg = message.get("message", "")

    # Get recent transactions for context
    acc_result = await db.execute(select(Account.id).where(Account.user_id == current_user.id))
    account_ids = [row[0] for row in acc_result.fetchall()]

    txn_result = await db.execute(
        select(Transaction)
        .where(Transaction.account_id.in_(account_ids))
        .order_by(desc(Transaction.created_at))
        .limit(50)
    )
    transactions = txn_result.scalars().all()

    # Build transaction summary for AI context
    txn_summary = []
    for t in transactions:
        txn_summary.append(f"{t.created_at.strftime('%Y-%m-%d')} | {t.type.value} | ₹{float(t.amount)} | {t.category or 'uncategorized'} | {t.merchant or 'N/A'}")

    context = "\n".join(txn_summary[:30])

    # Simulate AI response (replace with real OpenAI call)
    from openai import AsyncOpenAI
    from core.config import settings

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    try:
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": f"You are a helpful financial assistant. The user's transactions are:\n{context}\n\nBe concise, helpful, and insightful. Suggest categories, anomalies, and tips."
                },
                {"role": "user", "content": user_msg}
            ],
            max_tokens=500,
            temperature=0.7,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        reply = f"I'm here to help with your finances. You asked: '{user_msg}'. Based on your recent transactions, I can see you have {len(transactions)} records. What would you like to know about your spending?"

    suggestions = [
        "Why did I spend more this month?",
        "Show my top spending categories",
        "Any unusual transactions?",
        "Can I afford a ₹50,000 purchase?",
    ]

    return {
        "reply": reply,
        "conversation_id": "conv_001",
        "suggestions": suggestions,
    }


@router.post("/budget-simulate")
async def budget_simulate(data: dict, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    item = data.get("item", "")
    amount = float(data.get("amount", 0))
    months = int(data.get("months", 1))

    # Get monthly income vs expenses
    acc_result = await db.execute(select(Account.id).where(Account.user_id == current_user.id))
    account_ids = [row[0] for row in acc_result.fetchall()]

    from datetime import datetime, timedelta

    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    txn_result = await db.execute(
        select(func.sum(Transaction.amount))
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.type.in_(["credit"]),
            Transaction.created_at >= thirty_days_ago,
        )
    )
    monthly_income = float(txn_result.scalar() or 0)

    txn_result = await db.execute(
        select(func.sum(Transaction.amount))
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.type.in_(["debit", "transfer_out"]),
            Transaction.created_at >= thirty_days_ago,
        )
    )
    monthly_expenses = float(txn_result.scalar() or 0)

    savings_rate = (monthly_income - monthly_expenses) / monthly_income * 100 if monthly_income > 0 else 0

    can_afford = monthly_expenses + (amount / months) < monthly_income * 0.8
    risk_score = min(100, int((monthly_expenses / (monthly_income or 1)) * 100))

    return {
        "item": item,
        "amount": amount,
        "months": months,
        "monthly_payment": round(amount / months, 2),
        "monthly_income": monthly_income,
        "monthly_expenses": monthly_expenses,
        "savings_rate": round(savings_rate, 1),
        "can_afford": can_afford,
        "risk_score": risk_score,
        "recommendation": "Go for it!" if can_afford else "Consider saving more first.",
    }