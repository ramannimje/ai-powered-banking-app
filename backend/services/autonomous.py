from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
from sqlalchemy import select, func, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.models import User, Account, Transaction, SavingsVault, Notification
from core.models_ai import SpendingAnomaly
from core.models_autonomous import RuleExecutionLog
from core.auth import get_current_user
from core.config import settings
from core.auth import hash_password, verify_password
from fastapi import APIRouter, Depends, HTTPException, Query

router = APIRouter(prefix="/autonomous", tags=["Autonomous Agent"])


# ─── List Rules ────────────────────────────────────────────────
@router.get("/rules")
async def list_rules(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutonomousRule)
        .where(AutonomousRule.user_id == current_user.id)
        .order_by(desc(AutonomousRule.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rules = result.scalars().all()

    count = (await db.execute(
        select(func.count()).where(AutonomousRule.user_id == current_user.id)
    )).scalar()

    return {
        "items": [format_rule(r) for r in rules],
        "total": count,
        "page": page,
        "page_size": page_size,
    }


# ─── Create Rule ───────────────────────────────────────────────
@router.post("/rules")
async def create_rule(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from core.schemas import RuleCreate
    body = RuleCreate(**data)

    # Validate vault if action targets a vault
    action = body.action
    vault_id = action.get("vault_id")
    if vault_id:
        vault_result = await db.execute(
            select(SavingsVault).where(
                SavingsVault.id == vault_id,
                SavingsVault.user_id == current_user.id,
            )
        )
        vault = vault_result.scalar_one_or_none()
        if not vault:
            raise HTTPException(status_code=404, detail="Savings vault not found")

    rule = AutonomousRule(
        user_id=current_user.id,
        name=body.name,
        description=body.description,
        trigger_condition=body.trigger_condition,
        action=body.action,
        is_active=True,
    )
    db.add(rule)
    await db.flush()

    # Create execution log for creation
    log = RuleExecutionLog(
        rule_id=rule.id,
        user_id=current_user.id,
        triggered=False,
        action_taken=f"Rule '{body.name}' created and activated",
        metadata={"rule_name": body.name},
    )
    db.add(log)
    await db.flush()

    return format_rule(rule)


# ─── Update Rule ────────────────────────────────────────────────
@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: UUID,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutonomousRule).where(
            AutonomousRule.id == rule_id,
            AutonomousRule.user_id == current_user.id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if "name" in data:
        rule.name = data["name"]
    if "description" in data:
        rule.description = data["description"]
    if "is_active" in data:
        rule.is_active = data["is_active"]
    if "trigger_condition" in data:
        rule.trigger_condition = data["trigger_condition"]
    if "action" in data:
        rule.action = data["action"]

    rule.updated_at = datetime.utcnow()
    await db.flush()
    return format_rule(rule)


# ─── Delete Rule ────────────────────────────────────────────────
@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AutonomousRule).where(
            AutonomousRule.id == rule_id,
            AutonomousRule.user_id == current_user.id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.delete(rule)
    await db.flush()
    return {"ok": True}


# ─── Execute / Test Rule ───────────────────────────────────────
@router.post("/rules/{rule_id}/execute")
async def execute_rule(
    rule_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger a rule evaluation and execution."""
    result = await db.execute(
        select(AutonomousRule).where(
            AutonomousRule.id == rule_id,
            AutonomousRule.user_id == current_user.id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    # Run the evaluation
    triggered, reason = await evaluate_rule_trigger(rule, current_user, db)

    if triggered:
        # Execute the action
        action_result = await execute_rule_action(rule, current_user, db)

        # Log execution
        log = RuleExecutionLog(
            rule_id=rule.id,
            user_id=current_user.id,
            triggered=True,
            trigger_reason=reason,
            action_taken=action_result.get("message"),
            amount_transferred=action_result.get("amount"),
            vault_id=action_result.get("vault_id"),
            success=action_result.get("success", False),
            error_message=action_result.get("error"),
            metadata=action_result.get("metadata"),
        )
        db.add(log)

        rule.last_triggered_at = datetime.utcnow()
        rule.trigger_count += 1
        rule.last_execution_log = action_result
        await db.flush()

        return {
            "triggered": True,
            "reason": reason,
            "result": action_result,
        }

    # Log non-trigger
    log = RuleExecutionLog(
        rule_id=rule.id,
        user_id=current_user.id,
        triggered=False,
        trigger_reason=reason or "Conditions not met",
        action_taken="No action — conditions not met",
    )
    db.add(log)
    await db.flush()

    return {"triggered": False, "reason": reason}


# ─── Rule Execution History ────────────────────────────────────
@router.get("/rules/{rule_id}/logs")
async def get_rule_logs(
    rule_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify ownership
    rule_result = await db.execute(
        select(AutonomousRule).where(
            AutonomousRule.id == rule_id,
            AutonomousRule.user_id == current_user.id,
        )
    )
    if not rule_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Rule not found")

    result = await db.execute(
        select(RuleExecutionLog)
        .where(RuleExecutionLog.rule_id == rule_id)
        .order_by(desc(RuleExecutionLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": str(l.id),
                "triggered": l.triggered,
                "trigger_reason": l.trigger_reason,
                "action_taken": l.action_taken,
                "amount_transferred": l.amount_transferred,
                "success": l.success,
                "error_message": l.error_message,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ],
    }


# ─── Agent Status Dashboard ─────────────────────────────────────
@router.get("/status")
async def agent_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rules_result = await db.execute(
        select(func.count()).where(
            AutonomousRule.user_id == current_user.id,
            AutonomousRule.is_active == True,
        )
    )
    active_rules = rules_result.scalar()

    total_rules_result = await db.execute(
        select(func.count()).where(AutonomousRule.user_id == current_user.id)
    )
    total_rules = total_rules_result.scalar()

    # Total saved via rules
    saved_result = await db.execute(
        select(func.sum(RuleExecutionLog.amount_transferred))
        .where(
            RuleExecutionLog.user_id == current_user.id,
            RuleExecutionLog.triggered == True,
            RuleExecutionLog.success == True,
        )
    )
    total_saved = float(saved_result.scalar() or 0)

    # Last trigger
    last_log_result = await db.execute(
        select(RuleExecutionLog)
        .where(RuleExecutionLog.user_id == current_user.id, RuleExecutionLog.triggered == True)
        .order_by(desc(RuleExecutionLog.created_at))
        .limit(1)
    )
    last_log = last_log_result.scalar_one_or_none()

    return {
        "active_rules": active_rules,
        "total_rules": total_rules,
        "total_saved": total_saved,
        "last_execution": last_log.created_at.isoformat() if last_log else None,
        "last_execution_amount": last_log.amount_transferred if last_log else None,
        "status": "active" if active_rules > 0 else "idle",
    }


# ─── Rule Engine Logic ──────────────────────────────────────────

async def evaluate_rule_trigger(rule: "AutonomousRule", user: User, db: AsyncSession) -> tuple[bool, Optional[str]]:
    """
    Evaluate a rule's trigger condition against the user's recent financial data.
    Returns (triggered: bool, reason: str).
    """
    trigger = rule.trigger_condition
    trigger_type = trigger.get("type")

    # Get user's accounts
    acc_result = await db.execute(select(Account.id).where(Account.user_id == user.id))
    account_ids = [row[0] for row in acc_result.fetchall()]

    now = datetime.utcnow()

    if trigger_type == "spending_below_average":
        # Rule: if category spending is below X% of weekly average, trigger
        category = trigger.get("category")
        threshold = float(trigger.get("threshold", 0.8))  # e.g. 0.8 = 80% of average

        thirty_days_ago = now - timedelta(days=30)
        four_weeks_ago = now - timedelta(days=28)

        # Last 7 days spending
        one_week_ago = now - timedelta(days=7)
        week_result = await db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.account_id.in_(account_ids),
                Transaction.category == category,
                Transaction.type.in_(["debit", "transfer_out"]),
                Transaction.created_at >= one_week_ago,
            )
        )
        last_week = float(week_result.scalar() or 0)

        # 4-week average
        four_week_result = await db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.account_id.in_(account_ids),
                Transaction.category == category,
                Transaction.type.in_(["debit", "transfer_out"]),
                Transaction.created_at >= thirty_days_ago,
            )
        )
        total_4week = float(four_week_result.scalar() or 0)
        weekly_avg = total_4week / 4 if total_4week > 0 else 0

        if weekly_avg > 500 and last_week < weekly_avg * threshold:
            pct_saved = round((1 - last_week / weekly_avg) * 100, 1)
            return True, f"Food spending was {pct_saved}% below your weekly average (₹{last_week:,.0f} vs avg ₹{weekly_avg:,.0f})"

        return False, f"Food spending was ₹{last_week:,.0f} (above threshold)"

    elif trigger_type == "spending_above_average":
        category = trigger.get("category")
        threshold = float(trigger.get("threshold", 1.5))  # e.g. 1.5 = 150% of average

        one_week_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        week_result = await db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.account_id.in_(account_ids),
                Transaction.category == category,
                Transaction.type.in_(["debit", "transfer_out"]),
                Transaction.created_at >= one_week_ago,
            )
        )
        last_week = float(week_result.scalar() or 0)

        four_week_result = await db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.account_id.in_(account_ids),
                Transaction.category == category,
                Transaction.type.in_(["debit", "transfer_out"]),
                Transaction.created_at >= thirty_days_ago,
            )
        )
        weekly_avg = float(four_week_result.scalar() or 0) / 4

        if weekly_avg > 0 and last_week > weekly_avg * threshold:
            pct_over = round((last_week / weekly_avg - 1) * 100, 1)
            return True, f"Entertainment spending is {pct_over}% above average — save the excess!"

        return False, None

    elif trigger_type == "every_transaction":
        # Trigger on any new transaction
        threshold = float(trigger.get("threshold", 50))  # Min amount
        return False, "Every-transaction mode only triggers via background workers"

    elif trigger_type == "daily_savings":
        # Rule: if total daily spending is below X, save Y
        min_spending = float(trigger.get("min_spending", 2000))
        save_amount = float(trigger.get("save_amount", 100))

        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        day_result = await db.execute(
            select(func.sum(Transaction.amount)).where(
                Transaction.account_id.in_(account_ids),
                Transaction.type.in_(["debit", "transfer_out"]),
                Transaction.created_at >= today_start,
            )
        )
        today_spending = float(day_result.scalar() or 0)

        if today_spending < min_spending:
            return True, f"Daily spending (₹{today_spending:,.0f}) is below ₹{min_spending:,.0f} threshold"
        return False, None

    elif trigger_type == "balance_threshold":
        # Rule: if balance exceeds X, save Y
        min_balance = float(trigger.get("min_balance", 50000))
        save_amount = float(trigger.get("save_amount", 1000))

        balance_result = await db.execute(
            select(func.sum(Account.balance)).where(Account.user_id == user.id, Account.is_primary == True)
        )
        balance = float(balance_result.scalar() or 0)

        if balance > min_balance:
            return True, f"Primary balance (₹{balance:,.0f}) exceeds ₹{min_balance:,.0f} — saving ₹{save_amount:,.0f}"
        return False, None

    return False, None


async def execute_rule_action(rule: "AutonomousRule", user: User, db: AsyncSession) -> dict:
    """
    Execute the action defined in a rule. Returns dict with result details.
    """
    action = rule.action
    action_type = action.get("type")
    result = {"success": False, "message": "", "amount": None, "vault_id": None, "metadata": {}}

    # Get primary account
    acc_result = await db.execute(
        select(Account).where(Account.user_id == user.id, Account.is_primary == True)
    )
    account = acc_result.scalar_one_or_none()
    if not account:
        result["error"] = "No primary account found"
        return result

    if action_type == "save_amount":
        amount = float(action.get("amount", 0))
        vault_id = action.get("vault_id")

        if account.balance < Decimal(str(amount)):
            result["error"] = f"Insufficient balance (need ₹{amount:,.2f})"
            return result

        # Find vault
        vault = None
        if vault_id:
            vault_result = await db.execute(
                select(SavingsVault).where(SavingsVault.id == vault_id, SavingsVault.user_id == user.id)
            )
            vault = vault_result.scalar_one_or_none()

        if not vault:
            # Find or create a default "Auto-Savings" vault
            vault_result = await db.execute(
                select(SavingsVault).where(
                    SavingsVault.user_id == user.id,
                    SavingsVault.name == "Auto-Savings Vault",
                )
            )
            vault = vault_result.scalar_one_or_none()
            if not vault:
                vault = SavingsVault(
                    user_id=user.id,
                    account_id=account.id,
                    name="Auto-Savings Vault",
                    color="#6366F1",
                    interest_rate=Decimal("4.50"),
                )
                db.add(vault)
                await db.flush()

        # Execute transfer
        import uuid as uuid_mod
        ref_id = f"AUTO{uuid_mod.uuid4().hex[:12].upper()}"

        # Debit from account
        account.balance -= Decimal(str(amount))
        txn = Transaction(
            account_id=account.id,
            type=TransactionType.TRANSFER_OUT,
            status=TransactionStatus.COMPLETED,
            amount=Decimal(str(amount)),
            currency=account.currency,
            description=f"Auto-savings: {rule.name}",
            reference_id=ref_id,
            balance_after=account.balance,
            completed_at=datetime.utcnow(),
            metadata={"autonomous_rule_id": str(rule.id), "rule_name": rule.name},
        )
        db.add(txn)

        # Credit to vault
        vault.current_amount += Decimal(str(amount))
        vault_txn = Transaction(
            account_id=vault.account_id,
            type=TransactionType.CREDIT,
            status=TransactionStatus.COMPLETED,
            amount=Decimal(str(amount)),
            currency=vault.currency,
            description=f"Auto-savings: {rule.name}",
            reference_id=f"{ref_id}-VAULT",
            balance_after=vault.current_amount,
            completed_at=datetime.utcnow(),
        )
        db.add(vault_txn)
        await db.flush()

        result["success"] = True
        result["amount"] = amount
        result["vault_id"] = vault.id
        result["message"] = f"Saved ₹{amount:,.2f} to '{vault.name}' via rule '{rule.name}'"
        result["metadata"] = {
            "reference_id": ref_id,
            "account_balance_after": float(account.balance),
            "vault_balance_after": float(vault.current_amount),
        }

    elif action_type == "round_up":
        # Round up savings — save the difference to nearest ₹10
        # This is typically triggered per transaction, so for manual trigger
        # we calculate total round-up for the day
        result["success"] = True
        result["message"] = "Round-up savings calculated — configure per-transaction mode for automatic triggers"
        result["metadata"] = {"note": "Use background worker for per-transaction round-up"}

    elif action_type == "save_percent":
        percent = float(action.get("percent", 50))
        result["success"] = True
        result["message"] = f"Would save {percent}% of category total — configure with transaction data for full execution"
        result["metadata"] = {"percent": percent}

    # Send notification
    notification = Notification(
        user_id=user.id,
        type="savings",
        title=f"💰 Auto-Savings: {rule.name}",
        body=result["message"],
        metadata={
            "rule_id": str(rule.id),
            "rule_name": rule.name,
            "amount": result.get("amount"),
            "vault_id": str(result.get("vault_id")) if result.get("vault_id") else None,
            "success": result["success"],
        },
    )
    db.add(notification)
    await db.flush()

    return result


def format_rule(rule):
    return {
        "id": str(rule.id),
        "name": rule.name,
        "description": rule.description,
        "is_active": rule.is_active,
        "trigger_condition": rule.trigger_condition,
        "action": rule.action,
        "last_triggered_at": rule.last_triggered_at.isoformat() if rule.last_triggered_at else None,
        "trigger_count": rule.trigger_count,
        "created_at": rule.created_at.isoformat(),
        "updated_at": rule.updated_at.isoformat() if rule.updated_at else None,
    }


# Import at bottom to avoid circular
from core.models import AutonomousRule, TransactionType, TransactionStatus