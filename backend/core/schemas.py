from datetime import datetime
from decimal import Decimal
from typing import Optional, Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ─── Auth Schemas ───────────────────────────────────────────────
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1)
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class GoogleAuthUrlResponse(BaseModel):
    url: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone: Optional[str]
    is_verified: bool
    avatar_url: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Account Schemas ────────────────────────────────────────────
class AccountCreate(BaseModel):
    currency: str = "INR"
    account_name: str


class AccountResponse(BaseModel):
    id: UUID
    user_id: UUID
    currency: str
    balance: Decimal
    account_number: str
    account_name: str
    is_primary: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AccountDetail(AccountResponse):
    recent_transactions: list["TransactionResponse"] = []


# ─── Transaction Schemas ───────────────────────────────────────
class TransactionCreate(BaseModel):
    account_id: UUID
    type: str  # credit, debit, transfer
    amount: Decimal = Field(gt=0)
    currency: str = "INR"
    category: Optional[str] = None
    merchant: Optional[str] = None
    description: Optional[str] = None
    to_account_id: Optional[UUID] = None


class TransferRequest(BaseModel):
    from_account_id: UUID
    to_account_id: UUID
    amount: Decimal = Field(gt=0)
    description: Optional[str] = None


class TransactionResponse(BaseModel):
    id: UUID
    account_id: UUID
    type: str
    status: str
    amount: Decimal
    currency: str
    category: Optional[str]
    merchant: Optional[str]
    description: Optional[str]
    reference_id: str
    created_at: datetime
    balance_after: Optional[Decimal]

    model_config = {"from_attributes": True}


# ─── Vault Schemas ─────────────────────────────────────────────
class VaultCreate(BaseModel):
    name: str
    goal_amount: Optional[Decimal] = None
    description: Optional[str] = None
    color: str = "#6366F1"


class VaultResponse(BaseModel):
    id: UUID
    user_id: UUID
    account_id: UUID
    name: str
    goal_amount: Optional[Decimal]
    current_amount: Decimal
    interest_rate: Decimal
    currency: str
    status: str
    color: str
    progress_percent: float = 0.0

    model_config = {"from_attributes": True}

    @classmethod
    def from_orm_with_progress(cls, vault) -> "VaultResponse":
        progress = 0.0
        if vault.goal_amount and vault.goal_amount > 0:
            progress = float(vault.current_amount / vault.goal_amount * 100)
        data = vault.__dict__.copy()
        data["progress_percent"] = min(progress, 100.0)
        return cls(**data)


class VaultDeposit(BaseModel):
    vault_id: UUID
    amount: Decimal = Field(gt=0)


# ─── Card Schemas ─────────────────────────────────────────────
class CardResponse(BaseModel):
    id: UUID
    user_id: UUID
    account_id: UUID
    card_number_last4: str
    card_holder_name: str
    expiry_month: int
    expiry_year: int
    status: str
    daily_limit: Decimal
    monthly_limit: Decimal
    is_virtual: bool
    card_network: str

    model_config = {"from_attributes": True}


class CardFreezeRequest(BaseModel):
    card_id: UUID
    freeze: bool  # True = freeze, False = unfreeze


# ─── Autonomous Rule Schemas ──────────────────────────────────
class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_condition: dict
    action: dict


class RuleResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    description: Optional[str]
    is_active: bool
    trigger_condition: dict
    action: dict
    last_triggered_at: Optional[datetime]
    trigger_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Notification Schemas ──────────────────────────────────────
class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    body: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── AI Copilot Schemas ───────────────────────────────────────
class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    suggestions: list[str] = []


# ─── Pagination ───────────────────────────────────────────────
class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    pages: int


# Update forward refs
TransactionResponse.model_rebuild()