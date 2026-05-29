from uuid import UUID, uuid4
from datetime import datetime
from sqlalchemy import String, ForeignKey, Text, Boolean, JSON, Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class RuleExecutionLog(Base):
    """Audit log of every rule evaluation — what triggered, what action was taken."""
    __tablename__ = "rule_execution_logs"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    rule_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("autonomous_rules.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), index=True)

    triggered: Mapped[bool] = mapped_column(Boolean, default=False)
    trigger_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_taken: Mapped[str | None] = mapped_column(Text, nullable=True)  # e.g. "Saved ₹500 to MacBook Vault"
    amount_transferred: Mapped[float | None] = mapped_column(nullable=True)
    vault_id: Mapped[uuid.UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("savings_vaults.id"), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # tx_ref, account balances before/after

    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, index=True)

    rule = relationship("AutonomousRule", backref="execution_logs")
    vault = relationship("SavingsVault")