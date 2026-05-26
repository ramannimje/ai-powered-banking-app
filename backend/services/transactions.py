import random
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.models import Account, Transaction, TransactionType, TransactionStatus, User, AccountCurrency
from core.schemas import TransactionCreate, TransactionResponse, TransferRequest, PaginatedResponse
from core.auth import get_current_user

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def generate_reference_id() -> str:
    return f"TXN{uuid.uuid4().hex[:12].upper()}"


@router.get("")
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    transaction_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get all account IDs for user
    acc_result = await db.execute(select(Account.id).where(Account.user_id == current_user.id))
    account_ids = [row[0] for row in acc_result.fetchall()]

    if not account_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "pages": 0}

    query = select(Transaction).where(Transaction.account_id.in_(account_ids))

    if category:
        query = query.where(Transaction.category == category)
    if transaction_type:
        query = query.where(Transaction.type == transaction_type)
    if start_date:
        query = query.where(Transaction.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(Transaction.created_at <= datetime.fromisoformat(end_date))

    # Count
    from sqlalchemy import func

    count_query = select(func.count()).select_from(
        query.subquery()
    )
    total = (await db.execute(count_query)).scalar()

    # Paginate
    query = query.order_by(desc(Transaction.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    transactions = result.scalars().all()

    return {
        "items": [
            {
                "id": str(t.id),
                "account_id": str(t.account_id),
                "type": t.type.value,
                "status": t.status.value,
                "amount": float(t.amount),
                "currency": t.currency.value,
                "category": t.category,
                "merchant": t.merchant,
                "description": t.description,
                "reference_id": t.reference_id,
                "created_at": t.created_at.isoformat(),
                "balance_after": float(t.balance_after) if t.balance_after else None,
            }
            for t in transactions
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.post("")
async def create_transaction(
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify account ownership
    result = await db.execute(
        select(Account).where(Account.id == data.account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    txn_type_map = {
        "credit": TransactionType.CREDIT,
        "debit": TransactionType.DEBIT,
        "transfer": TransactionType.TRANSFER_OUT,
    }
    txn_type = txn_type_map.get(data.type.lower())
    if not txn_type:
        raise HTTPException(status_code=400, detail="Invalid transaction type")

    # Update balance
    if txn_type == TransactionType.CREDIT:
        account.balance += Decimal(str(data.amount))
    elif txn_type in (TransactionType.DEBIT, TransactionType.TRANSFER_OUT):
        if account.balance < Decimal(str(data.amount)):
            raise HTTPException(status_code=400, detail="Insufficient balance")
        account.balance -= Decimal(str(data.amount))

    transaction = Transaction(
        account_id=account.id,
        type=txn_type,
        status=TransactionStatus.COMPLETED,
        amount=Decimal(str(data.amount)),
        currency=account.currency,
        category=data.category,
        merchant=data.merchant,
        description=data.description,
        reference_id=generate_reference_id(),
        balance_after=account.balance,
        completed_at=datetime.utcnow(),
    )
    db.add(transaction)
    await db.flush()

    return {
        "id": str(transaction.id),
        "reference_id": transaction.reference_id,
        "status": "completed",
        "amount": float(transaction.amount),
        "balance_after": float(transaction.balance_after),
        "created_at": transaction.created_at.isoformat(),
    }


@router.post("/transfer")
async def transfer_funds(
    data: TransferRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify from_account ownership
    result = await db.execute(
        select(Account).where(Account.id == data.from_account_id, Account.user_id == current_user.id)
    )
    from_account = result.scalar_one_or_none()
    if not from_account:
        raise HTTPException(status_code=404, detail="Source account not found")

    # Verify to_account exists
    result = await db.execute(select(Account).where(Account.id == data.to_account_id))
    to_account = result.scalar_one_or_none()
    if not to_account:
        raise HTTPException(status_code=404, detail="Destination account not found")

    amount = Decimal(str(data.amount))
    if from_account.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    ref_id = generate_reference_id()

    # Debit from_account
    from_account.balance -= amount
    debit_txn = Transaction(
        account_id=from_account.id,
        to_account_id=to_account.id,
        type=TransactionType.TRANSFER_OUT,
        status=TransactionStatus.COMPLETED,
        amount=amount,
        currency=from_account.currency,
        description=data.description or "Transfer",
        reference_id=ref_id,
        balance_after=from_account.balance,
        completed_at=datetime.utcnow(),
    )
    db.add(debit_txn)

    # Credit to_account
    to_account.balance += amount
    credit_txn = Transaction(
        account_id=to_account.id,
        to_account_id=from_account.id,
        type=TransactionType.TRANSFER_IN,
        status=TransactionStatus.COMPLETED,
        amount=amount,
        currency=to_account.currency,
        description=data.description or "Transfer received",
        reference_id=f"{ref_id}-CR",
        balance_after=to_account.balance,
        completed_at=datetime.utcnow(),
    )
    db.add(credit_txn)
    await db.flush()

    return {
        "reference_id": ref_id,
        "status": "completed",
        "amount": float(amount),
        "from_account": str(from_account.id),
        "to_account": str(to_account.id),
        "balance_after": float(from_account.balance),
    }


@router.get("/{transaction_id}")
async def get_transaction(
    transaction_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Transaction).where(Transaction.id == transaction_id))
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Verify ownership via account
    acc_result = await db.execute(select(Account).where(Account.id == txn.account_id))
    account = acc_result.scalar_one_or_none()
    if not account or account.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Transaction not found")

    return {
        "id": str(txn.id),
        "type": txn.type.value,
        "status": txn.status.value,
        "amount": float(txn.amount),
        "currency": txn.currency.value,
        "category": txn.category,
        "merchant": txn.merchant,
        "description": txn.description,
        "reference_id": txn.reference_id,
        "created_at": txn.created_at.isoformat(),
        "balance_after": float(txn.balance_after) if txn.balance_after else None,
    }