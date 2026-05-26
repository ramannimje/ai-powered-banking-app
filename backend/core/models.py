import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey, Index, Numeric,
    String, Text, UniqueConstraint, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


# ─── Enums ─────────────────────────────────────────────────────
class UserRole(PyEnum):
    USER = "user"
    ADMIN = "admin"


class TransactionType(PyEnum):
    CREDIT = "credit"
    DEBIT = "debit"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"


class TransactionStatus(PyEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REVERSED = "reversed"


class AccountCurrency(PyEnum):
    INR = "INR"
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"


class CardStatus(PyEnum):
    ACTIVE = "active"
    FROZEN = "frozen"
    BLOCKED = "blocked"


class VaultStatus(PyEnum):
    ACTIVE = "active"
    FROZEN = "frozen"
    CLOSED = "closed"


# ─── Models ────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.USER)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Google OAuth
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    google_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relations
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    cards = relationship("Card", back_populates="user", cascade="all, delete-orphan")
    vaults = relationship("SavingsVault", back_populates="user", cascade="all, delete-orphan")
    autonomous_rules = relationship("AutonomousRule", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    currency: Mapped[AccountCurrency] = mapped_column(Enum(AccountCurrency), default=AccountCurrency.INR)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"))
    account_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    account_name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_account_user_currency", "user_id", "currency", unique=True),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), index=True)
    to_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)

    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType))
    status: Mapped[TransactionStatus] = mapped_column(Enum(TransactionStatus), default=TransactionStatus.PENDING)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[AccountCurrency] = mapped_column(Enum(AccountCurrency), default=AccountCurrency.INR)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(18, 2))

    category: Mapped[str | None] = mapped_column(String(50), nullable=True)  # food, travel, entertainment, etc.
    merchant: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reference_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)

    metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # extra data, fraud flags, etc.

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    account = relationship("Account", back_populates="transactions", foreign_keys=[account_id])
    to_account = relationship("Account", foreign_keys=[to_account_id])

    __table_args__ = (
        Index("ix_transaction_user_created", "account_id", "created_at"),
        Index("ix_transaction_category", "category"),
    )


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), index=True)

    card_number_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    card_holder_name: Mapped[str] = mapped_column(String(255))
    expiry_month: Mapped[int] = mapped_column(nullable=False)
    expiry_year: Mapped[int] = mapped_column(nullable=False)
    cvv_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    status: Mapped[CardStatus] = mapped_column(Enum(CardStatus), default=CardStatus.ACTIVE)
    daily_limit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("50000.00"))
    monthly_limit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("200000.00"))

    is_virtual: Mapped[bool] = mapped_column(Boolean, default=True)
    card_network: Mapped[str] = mapped_column(String(20), default="Visa")  # Visa, Mastercard

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="cards")
    account = relationship("Account")


class SavingsVault(Base):
    __tablename__ = "savings_vaults"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), index=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    goal_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0.00"))
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("4.50"))  # APY %
    currency: Mapped[AccountCurrency] = mapped_column(Enum(AccountCurrency), default=AccountCurrency.INR)
    status: Mapped[VaultStatus] = mapped_column(Enum(VaultStatus), default=VaultStatus.ACTIVE)

    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    color: Mapped[str] = mapped_column(String(7), default="#6366F1")  # hex color for UI

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="vaults")
    account = relationship("Account")


class AutonomousRule(Base):
    __tablename__ = "autonomous_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Trigger condition (stored as JSON for flexibility)
    trigger_condition: Mapped[dict] = mapped_column(JSON, nullable=False)  # e.g. {"type": "spending_below_average", "category": "food", "threshold": 0.8}
    # Action to take
    action: Mapped[dict] = mapped_column(JSON, nullable=False)  # e.g. {"type": "save_amount", "amount": 500, "vault_id": "uuid"}

    last_triggered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    trigger_count: Mapped[int] = mapped_column(default=0)
    last_execution_log: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="autonomous_rules")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)

    type: Mapped[str] = mapped_column(String(50), nullable=False)  # fraud_alert, savings, budget, transfer
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="notifications")