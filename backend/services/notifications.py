from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.models import User, Notification, Card, SavingsVault, Account, AccountCurrency, VaultStatus, CardStatus
from core.auth import get_current_user
from core.schemas import VaultCreate, VaultDeposit, VaultResponse, CardFreezeRequest

router = APIRouter(prefix="/vaults", tags=["Vaults"])


@router.get("")
async def list_vaults(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavingsVault).where(SavingsVault.user_id == current_user.id))
    vaults = result.scalars().all()

    return [
        {
            "id": str(v.id),
            "name": v.name,
            "goal_amount": float(v.goal_amount) if v.goal_amount else None,
            "current_amount": float(v.current_amount),
            "interest_rate": float(v.interest_rate),
            "currency": v.currency.value,
            "status": v.status.value,
            "color": v.color,
            "progress_percent": (
                min(float(v.current_amount / v.goal_amount * 100), 100.0)
                if v.goal_amount and v.goal_amount > 0
                else 0.0
            ),
        }
        for v in vaults
    ]


@router.post("")
async def create_vault(data: VaultCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Find primary INR account
    result = await db.execute(
        select(Account).where(Account.user_id == current_user.id, Account.currency == AccountCurrency.INR)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise Exception("No INR account found")

    vault = SavingsVault(
        user_id=current_user.id,
        account_id=account.id,
        name=data.name,
        goal_amount=data.goal_amount,
        description=data.description,
        color=data.color,
        interest_rate=4.50,
    )
    db.add(vault)
    await db.flush()

    return {
        "id": str(vault.id),
        "name": vault.name,
        "goal_amount": float(vault.goal_amount) if vault.goal_amount else None,
        "current_amount": float(vault.current_amount),
        "currency": vault.currency.value,
        "status": vault.status.value,
    }


@router.post("/deposit")
async def deposit_to_vault(data: VaultDeposit, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SavingsVault).where(SavingsVault.id == data.vault_id, SavingsVault.user_id == current_user.id)
    )
    vault = result.scalar_one_or_none()
    if not vault:
        raise Exception("Vault not found")

    from decimal import Decimal

    # Debit from account
    account_result = await db.execute(select(Account).where(Account.id == vault.account_id))
    account = account_result.scalar_one_or_none()

    if not account or account.balance < Decimal(str(data.amount)):
        raise Exception("Insufficient balance")

    account.balance -= Decimal(str(data.amount))
    vault.current_amount += Decimal(str(data.amount))
    await db.flush()

    return {
        "vault_id": str(vault.id),
        "deposited": float(data.amount),
        "new_balance": float(vault.current_amount),
        "goal_progress": (
            min(float(vault.current_amount / vault.goal_amount * 100), 100.0)
            if vault.goal_amount and vault.goal_amount > 0
            else 0.0
        ),
    }


# ─── Cards Router ─────────────────────────────────────────────
cards_router = APIRouter(prefix="/cards", tags=["Cards"])


@cards_router.get("")
async def list_cards(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Card).where(Card.user_id == current_user.id))
    cards = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "card_number_last4": c.card_number_last4,
            "card_holder_name": c.card_holder_name,
            "expiry_month": c.expiry_month,
            "expiry_year": c.expiry_year,
            "status": c.status.value,
            "daily_limit": float(c.daily_limit),
            "monthly_limit": float(c.monthly_limit),
            "is_virtual": c.is_virtual,
            "card_network": c.card_network,
        }
        for c in cards
    ]


@cards_router.post("")
async def create_virtual_card(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    import random
    from core.schemas import hash_password

    result = await db.execute(select(Account).where(Account.user_id == current_user.id))
    account = result.scalar_one_or_none()
    if not account:
        raise Exception("No account found")

    card = Card(
        user_id=current_user.id,
        account_id=account.id,
        card_number_last4=f"{random.randint(1000, 9999)}",
        card_holder_name=current_user.full_name,
        expiry_month=random.randint(1, 12),
        expiry_year=random.randint(2025, 2030),
        cvv_hash="placeholder",
        is_virtual=True,
    )
    db.add(card)
    await db.flush()

    return {
        "id": str(card.id),
        "card_number_last4": card.card_number_last4,
        "status": card.status.value,
        "is_virtual": True,
    }


@cards_router.post("/freeze")
async def freeze_card(data: CardFreezeRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Card).where(Card.id == data.card_id, Card.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise Exception("Card not found")

    card.status = CardStatus.FROZEN if data.freeze else CardStatus.ACTIVE
    await db.flush()

    return {"card_id": str(card.id), "status": card.status.value}


# ─── Notifications Router ────────────────────────────────────
notif_router = APIRouter(prefix="/notifications", tags=["Notifications"])


@notif_router.get("")
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        query = query.where(Notification.is_read == False)

    query = query.order_by(desc(Notification.created_at)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    notifications = result.scalars().all()

    return [
        {
            "id": str(n.id),
            "type": n.type,
            "title": n.title,
            "body": n.body,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]


@notif_router.post("/{notification_id}/read")
async def mark_read(notification_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id)
    )
    notification = result.scalar_one_or_none()
    if notification:
        notification.is_read = True
        await db.flush()

    return {"ok": True}