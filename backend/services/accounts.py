from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.models import Account, AccountCurrency, User
from core.schemas import AccountCreate, AccountResponse
from core.auth import get_current_user

router = APIRouter(prefix="/accounts", tags=["Accounts"])


@router.get("")
async def list_accounts(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Account).where(Account.user_id == current_user.id))
    accounts = result.scalars().all()
    return [
        {
            "id": str(acc.id),
            "user_id": str(acc.user_id),
            "currency": acc.currency.value,
            "balance": float(acc.balance),
            "account_number": acc.account_number,
            "account_name": acc.account_name,
            "is_primary": acc.is_primary,
            "is_active": acc.is_active,
            "created_at": acc.created_at.isoformat(),
        }
        for acc in accounts
    ]


@router.post("")
async def create_account(data: AccountCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    currency_map = {
        "INR": AccountCurrency.INR,
        "USD": AccountCurrency.USD,
        "EUR": AccountCurrency.EUR,
        "GBP": AccountCurrency.GBP,
    }

    currency = currency_map.get(data.currency.upper(), AccountCurrency.INR)

    # Check if account for this currency already exists
    existing = await db.execute(
        select(Account).where(Account.user_id == current_user.id, Account.currency == currency)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Account in {data.currency} already exists")

    import random

    account = Account(
        user_id=current_user.id,
        currency=currency,
        account_number=f"{data.currency}{random.randint(10**11, 10**12 - 1)}",
        account_name=data.account_name,
        is_primary=False,
        balance=0.00,
    )
    db.add(account)
    await db.flush()

    return {
        "id": str(account.id),
        "currency": account.currency.value,
        "balance": float(account.balance),
        "account_number": account.account_number,
        "account_name": account.account_name,
        "is_primary": account.is_primary,
    }


@router.get("/{account_id}")
async def get_account(account_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    return {
        "id": str(account.id),
        "currency": account.currency.value,
        "balance": float(account.balance),
        "account_number": account.account_number,
        "account_name": account.account_name,
        "is_primary": account.is_primary,
        "is_active": account.is_active,
    }


@router.get("/primary")
async def get_primary_account(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Account).where(Account.user_id == current_user.id, Account.is_primary == True)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="No primary account found")

    return {
        "id": str(account.id),
        "currency": account.currency.value,
        "balance": float(account.balance),
        "account_number": account.account_number,
        "account_name": account.account_name,
        "is_primary": True,
    }