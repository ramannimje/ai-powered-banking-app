from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy import String, ForeignKey, Text, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Conversation(Base):
    """AI Copilot conversation thread — persists multi-turn chat."""
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="New conversation")
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # e.g. {"tags": [], "summary": ""}
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)
    message_count: Mapped[int] = mapped_column(default=0)

    user = relationship("User", backref="conversations")
    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="ConversationMessage.created_at")


class ConversationMessage(Base):
    """Individual message within a conversation thread."""
    __tablename__ = "conversation_messages"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" or "ai"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. "gpt-4o"
    tokens_used: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")


class SpendingAnomaly(Base):
    """Detected spending anomaly — threshold breach, pattern change."""
    __tablename__ = "spending_anomalies"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)

    anomaly_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "spike", "recurring_change", "unusual_merchant"
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # "low", "medium", "high"
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    detected_amount: Mapped[float | None] = mapped_column(nullable=True)
    baseline_amount: Mapped[float | None] = mapped_column(nullable=True)
    threshold_pct: Mapped[float | None] = mapped_column(nullable=True)  # e.g. 50 = 50% above baseline
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True)

    user = relationship("User")
    account = relationship("Account")