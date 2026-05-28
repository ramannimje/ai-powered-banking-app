from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from uuid import UUID

from core.database import get_db
from core.models import User, Transaction, Account
from core.models_ai import Conversation, ConversationMessage, SpendingAnomaly
from core.auth import get_current_user

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/conversations")
async def list_conversations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all conversation threads for the user."""
    query = (
        select(Conversation)
        .where(Conversation.user_id == current_user.id, Conversation.is_archived == False)
        .order_by(desc(Conversation.updated_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    conversations = result.scalars().all()

    count_result = await db.execute(
        select(func.count()).where(
            Conversation.user_id == current_user.id,
            Conversation.is_archived == False
        )
    )
    total = count_result.scalar()

    return {
        "items": [
            {
                "id": str(c.id),
                "title": c.title,
                "message_count": c.message_count,
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
            }
            for c in conversations
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single conversation with all messages."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg_result = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.created_at)
    )
    messages = msg_result.scalars().all()

    return {
        "id": str(conv.id),
        "title": conv.title,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "model": m.model,
                "tokens_used": m.tokens_used,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "created_at": conv.created_at.isoformat(),
        "updated_at": conv.updated_at.isoformat(),
    }


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Archive (soft delete) a conversation."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv.is_archived = True
    await db.flush()
    return {"ok": True}


@router.post("/chat")
async def chat(
    message: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message and get an AI response, with full transaction context."""
    user_msg = message.get("message", "")
    conversation_id = message.get("conversation_id")  # None = new conversation

    if not user_msg.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Resolve or create conversation
    if conversation_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == UUID(conversation_id),
                Conversation.user_id == current_user.id,
            )
        )
        conv = result.scalar_one_or_none()
        if not conv:
            conv = None
    else:
        conv = None

    if not conv:
        conv = Conversation(
            user_id=current_user.id,
            title=user_msg[:80],  # First message as title
            message_count=0,
        )
        db.add(conv)
        await db.flush()

    # Save user message
    user_message = ConversationMessage(
        conversation_id=conv.id,
        role="user",
        content=user_msg,
    )
    db.add(user_message)

    # Build rich context from transaction history
    acc_result = await db.execute(select(Account.id).where(Account.user_id == current_user.id))
    account_ids = [row[0] for row in acc_result.fetchall()]

    if account_ids:
        txn_result = await db.execute(
            select(Transaction)
            .where(Transaction.account_id.in_(account_ids))
            .order_by(desc(Transaction.created_at))
            .limit(100)
        )
        transactions = txn_result.scalars().all()
    else:
        transactions = []

    # Context for AI
    now = datetime.utcnow()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=30))

    this_month_txns = [t for t in transactions if t.created_at >= this_month_start]
    last_month_txns = [t for t in transactions if this_month_start > t.created_at >= last_month_start]

    # Spending by category
    cat_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .where(
            Transaction.account_id.in_(account_ids),
            Transaction.type.in_(["debit", "transfer_out"]),
            Transaction.created_at >= this_month_start,
        )
        .group_by(Transaction.category)
    )
    categories = {row[0] or "uncategorized": float(row[1]) for row in cat_result}

    total_balance = sum(float(acc.balance or 0) for acc in await db.execute(
        select(Account.balance).where(Account.user_id == current_user.id)
    ).scalars().all())

    # Build system prompt with real data
    system_prompt = f"""You are an expert AI Financial Assistant embedded in "AI Smart Bank" — a modern Indian banking app.

USER PROFILE:
- Name: {current_user.full_name}
- Total Balance: ₹{total_balance:,.2f}
- This Month Spending: ₹{sum(categories.values()):,.2f}
- Last Month Spending: ₹{sum(float(db.execute(
    select(func.sum(Transaction.amount)).where(
        Transaction.account_id.in_(account_ids),
        Transaction.type.in_(["debit", "transfer_out"]),
        Transaction.created_at >= last_month_start,
        Transaction.created_at < this_month_start,
    ).scalar()) or 0):,.2f)}

CATEGORY BREAKDOWN (this month):
{chr(10).join(f"- {cat.title()}: ₹{amt:,.2f}" for cat, amt in sorted(categories.items(), key=lambda x: -x[1]))}

RECENT TRANSACTIONS (last 10):
{chr(10).join(f"{t.created_at.strftime('%d %b')} | {t.type.value} | ₹{float(t.amount)} | {t.category or 'misc'} | {t.merchant or t.description or 'N/A'}" for t in transactions[:10])}

INSTRUCTIONS:
- Give concise, actionable insights (2-3 sentences max for simple queries)
- For complex analysis, go deeper with specific numbers from the data
- Always ground your answers in the user's actual transaction history
- Flag anomalies and patterns clearly
- Suggest categories if transactions are uncategorized
- Be friendly but authoritative — you're a trusted financial advisor
- Never make up data — if you don't have enough info, say so
- Format numbers clearly: use ₹ and commas (e.g., ₹1,42,350)
"""

    # Get conversation history for context
    msg_result = await db.execute(
        select(ConversationMessage)
        .where(ConversationMessage.conversation_id == conv.id)
        .order_by(ConversationMessage.created_at)
        .limit(20)
    )
    history = msg_result.scalars().all()

    # Build messages list with history
    openai_messages = [
        {"role": "system", "content": system_prompt},
    ]
    for h in history:
        openai_messages.append({"role": h.role, "content": h.content})

    # Call OpenAI
    try:
        from openai import AsyncOpenAI
        from core.config import settings

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=openai_messages,
            max_tokens=600,
            temperature=0.7,
        )

        ai_reply = response.choices[0].message.content or "I'm here to help!"
        model_used = settings.OPENAI_MODEL
        tokens = response.usage.total_tokens if hasattr(response, "usage") else None

    except Exception as e:
        ai_reply = f"I'm having trouble connecting to the AI right now. Here's what I can tell you from your data:\n\nYou have {len(transactions)} transactions across {len(categories)} categories. Your top spending category is {max(categories, key=categories.get).title()} at ₹{max(categories.values()):,.2f} this month. Ask me something more specific and I'll dive deeper!"
        model_used = "fallback"
        tokens = None

    # Save AI response
    ai_message = ConversationMessage(
        conversation_id=conv.id,
        role="ai",
        content=ai_reply,
        model=model_used,
        tokens_used=tokens,
    )
    db.add(ai_message)

    # Update conversation
    conv.message_count = len(history) + 2
    conv.updated_at = datetime.utcnow()
    await db.flush()

    # Update title from first exchange
    if conv.message_count == 2:
        conv.title = user_msg[:60] + ("..." if len(user_msg) > 60 else "")

    suggestions = [
        "Why did I spend more this month?",
        "Show my top spending categories",
        "Any unusual transactions?",
        f"Can I afford a ₹{int(sum(categories.values()) * 0.3):,} purchase?",
    ]

    return {
        "reply": ai_reply,
        "conversation_id": str(conv.id),
        "suggestions": suggestions,
        "model": model_used,
        "tokens_used": tokens,
    }


# ─── Spending Anomaly Detection ────────────────────────────────
@router.get("/anomalies")
async def get_anomalies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    unresolved_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get detected spending anomalies."""
    query = select(SpendingAnomaly).where(SpendingAnomaly.user_id == current_user.id)
    if unresolved_only:
        query = query.where(SpendingAnomaly.is_resolved == False)
    query = query.order_by(desc(SpendingAnomaly.created_at)).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    anomalies = result.scalars().all()

    count_q = select(func.count()).select_from(
        select(SpendingAnomaly).where(SpendingAnomaly.user_id == current_user.id).subquery()
    )
    total = (await db.execute(count_q)).scalar()

    return {
        "items": [
            {
                "id": str(a.id),
                "anomaly_type": a.anomaly_type,
                "severity": a.severity,
                "category": a.category,
                "description": a.description,
                "detected_amount": a.detected_amount,
                "baseline_amount": a.baseline_amount,
                "threshold_pct": a.threshold_pct,
                "is_resolved": a.is_resolved,
                "created_at": a.created_at.isoformat(),
            }
            for a in anomalies
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/anomalies/{anomaly_id}/resolve")
async def resolve_anomaly(
    anomaly_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark an anomaly as resolved/acknowledged."""
    result = await db.execute(
        select(SpendingAnomaly).where(
            SpendingAnomaly.id == anomaly_id,
            SpendingAnomaly.user_id == current_user.id,
        )
    )
    anomaly = result.scalar_one_or_none()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")

    anomaly.is_resolved = True
    anomaly.resolved_at = datetime.utcnow()
    await db.flush()
    return {"ok": True}