"""
Seed data script — populates the database with realistic test data.
Run with: python -m scripts.seed_data
"""
import random
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from core.database import sync_engine, SyncSessionLocal, Base
from core.models import (
    User, Account, Transaction, Card, SavingsVault,
    AutonomousRule, Notification, UserRole, AccountCurrency,
    TransactionType, TransactionStatus, CardStatus, VaultStatus,
)
from core.auth import hash_password

# Categories with realistic merchants
CATEGORY_DATA = {
    "food": [
        ("Swiggy", [150, 400, 250, 380, 200, 450, 320]),
        ("Zomato", [180, 350, 220, 400, 290, 500, 280]),
        ("McDonald's", [280, 350, 420, 310, 380, 290, 400]),
        ("Domino's Pizza", [350, 480, 420, 550, 390, 600, 450]),
        ("Starbucks", [180, 220, 150, 290, 200, 180, 240]),
        ("CCD", [120, 180, 150, 200, 160, 140, 190]),
        ("Fresh & Co", [220, 300, 280, 350, 260, 320, 290]),
        (" Haldiram's", [180, 220, 200, 250, 210, 190, 230]),
    ],
    "travel": [
        ("Uber", [180, 250, 320, 200, 280, 350, 220]),
        ("Ola", [150, 200, 180, 220, 160, 190, 210]),
        ("Indigo", [3200, 4500, 2800, 5500, 3500, 4200, 3000]),
        ("IRCTC", [850, 1200, 980, 1500, 1100, 1350, 950]),
        ("RedBus", [450, 600, 520, 750, 580, 680, 550]),
        ("Metro", [40, 60, 50, 40, 60, 50, 40]),
    ],
    "shopping": [
        ("Amazon", [1200, 2500, 800, 3500, 1500, 2200, 1800]),
        ("Flipkart", [900, 1800, 1200, 2800, 1600, 2000, 1400]),
        ("Myntra", [1200, 1800, 2200, 1500, 2000, 2500, 1700]),
        ("Ajio", [800, 1400, 1000, 1900, 1100, 1600, 900]),
        ("Reliance Trends", [600, 800, 750, 900, 650, 850, 700]),
        ("BigBasket", [800, 1200, 900, 1100, 850, 1000, 880]),
    ],
    "entertainment": [
        ("Netflix", [499, 499, 499, 499, 499, 499, 499]),
        ("Spotify", [99, 99, 99, 99, 99, 99, 99]),
        ("Amazon Prime", [999, 999, 999, 999, 999, 999, 999]),
        ("BookMyShow", [600, 1200, 800, 1500, 900, 1100, 750]),
        ("PVR Cinemas", [450, 600, 550, 750, 500, 650, 480]),
        ("YouTube Premium", [129, 129, 129, 129, 129, 129, 129]),
        ("Hotstar", [299, 299, 299, 299, 299, 299, 299]),
    ],
    "utilities": [
        ("BSES Bill", [2400, 2400, 2400, 2400, 2400, 2400, 2400]),
        ("Airtel Postpaid", [599, 599, 599, 599, 599, 599, 599]),
        ("Jio Postpaid", [399, 399, 399, 399, 399, 399, 399]),
        ("Gas Bill", [850, 850, 850, 850, 850, 850, 850]),
        ("Water Bill", [200, 200, 200, 200, 200, 200, 200]),
        ("Internet", [999, 999, 999, 999, 999, 999, 999]),
    ],
    "health": [
        ("Apollo Pharmacy", [350, 600, 450, 700, 380, 550, 420]),
        ("1mg", [450, 800, 600, 900, 550, 750, 500]),
        ("MedPlus", [280, 400, 350, 480, 320, 420, 300]),
        ("Fitness First", [2500, 2500, 2500, 2500, 2500, 2500, 2500]),
        ("Practo", [500, 800, 600, 900, 550, 700, 580]),
    ],
    "education": [
        ("Coursera", [3000, 3000, 3000, 3000, 3000, 3000, 3000]),
        ("Udemy", [600, 1200, 800, 1500, 900, 1100, 750]),
        ("BYJU's", [2500, 2500, 2500, 2500, 2500, 2500, 2500]),
        ("Physics Wallah", [500, 500, 500, 500, 500, 500, 500]),
    ],
}


def generate_transactions(account_id: uuid.UUID, currency: AccountCurrency, days_back: int = 90) -> list[Transaction]:
    """Generate realistic transaction history for an account."""
    transactions = []
    now = datetime.utcnow()

    for day_offset in range(days_back, 0, -1):
        date = now - timedelta(days=day_offset)

        # Skip some days randomly (2-3 per week)
        if random.random() < 0.35:
            continue

        # Pick 2-5 transactions per day
        num_txns = random.randint(2, 5)
        used_categories = set()

        for _ in range(num_txns):
            # Pick category
            category = random.choice(list(CATEGORY_DATA.keys()))
            used_categories.add(category)

            merchants = CATEGORY_DATA[category]
            merchant, amounts = random.choice(merchants)
            amount = Decimal(str(random.choice(amounts)))

            # Occasionally add weekend spike
            if date.weekday() >= 5 and random.random() < 0.4:
                amount *= Decimal("1.5")

            # Debit vs credit (mostly debits for a spending account)
            if random.random() < 0.85:
                txn_type = random.choice([TransactionType.DEBIT, TransactionType.TRANSFER_OUT])
            else:
                txn_type = TransactionType.CREDIT

            txn = Transaction(
                account_id=account_id,
                type=txn_type,
                status=TransactionStatus.COMPLETED,
                amount=amount.quantize(Decimal("0.01")),
                currency=currency,
                category=category,
                merchant=merchant,
                description=f"{merchant} - {category}",
                reference_id=f"TXN{uuid.uuid4().hex[:12].upper()}",
                created_at=date + timedelta(hours=random.randint(8, 22), minutes=random.randint(0, 59)),
                completed_at=date + timedelta(hours=random.randint(8, 22)),
            )
            transactions.append(txn)

    # Sort by date
    transactions.sort(key=lambda t: t.created_at)

    # Calculate running balance
    running_balance = Decimal("50000")  # Start with 50k
    for txn in transactions:
        if txn.type in (TransactionType.CREDIT, TransactionType.TRANSFER_IN):
            running_balance += txn.amount
        else:
            running_balance -= txn.amount
        txn.balance_after = running_balance.quantize(Decimal("0.01"))

    return transactions


def seed_database():
    """Main seed function."""
    print("🌱 Seeding database...")

    # Create tables
    Base.metadata.create_all(sync_engine)

    with SyncSessionLocal() as db:
        # Check if already seeded
        existing = db.query(User).first()
        if existing:
            print("⚠️  Database already has users. Skipping seed.")
            return

        # ─── Users ──────────────────────────────────────────────
        users_data = [
            {"email": "demo@aisb.com", "full_name": "Raman Nimje", "phone": "+91 98765 43210", "is_verified": True},
            {"email": "priya@example.com", "full_name": "Priya Sharma", "phone": "+91 99887 66554", "is_verified": True},
        ]

        users = []
        for ud in users_data:
            user = User(
                email=ud["email"],
                hashed_password=hash_password("password123"),
                full_name=ud["full_name"],
                phone=ud["phone"],
                is_verified=ud["is_verified"],
                role=UserRole.USER,
            )
            db.add(user)
            users.append(user)

        db.flush()
        print(f"✅ Created {len(users)} users")

        # ─── Accounts ───────────────────────────────────────────
        accounts_data = []
        for user in users:
            for currency in [AccountCurrency.INR, AccountCurrency.USD]:
                balance = random.randint(30000, 150000) if currency == AccountCurrency.INR else random.randint(500, 5000)
                acc = Account(
                    user_id=user.id,
                    currency=currency,
                    account_number=f"{currency.value}{random.randint(10**11, 10**12 - 1)}",
                    account_name=f"Primary {currency.value} Account",
                    balance=Decimal(str(balance)),
                    is_primary=(currency == AccountCurrency.INR),
                )
                db.add(acc)
                accounts_data.append(acc)

        db.flush()
        print(f"✅ Created {len(accounts_data)} accounts")

        # ─── Transactions ─────────────────────────────────────────
        txn_count = 0
        for acc in accounts_data:
            txns = generate_transactions(acc.id, acc.currency, days_back=90)
            db.add_all(txns)
            txn_count += len(txns)

        db.flush()
        print(f"✅ Created {txn_count} transactions")

        # ─── Cards ───────────────────────────────────────────────
        for user in users:
            acc = [a for a in accounts_data if a.user_id == user.id and a.is_primary][0]
            for i, network in enumerate(["Visa", "Mastercard"]):
                card = Card(
                    user_id=user.id,
                    account_id=acc.id,
                    card_number_last4=f"{random.randint(1000, 9999)}",
                    card_holder_name=user.full_name,
                    expiry_month=random.randint(1, 12),
                    expiry_year=random.randint(2026, 2030),
                    cvv_hash="placeholder",
                    is_virtual=(i > 0),
                    card_network=network,
                    status=CardStatus.ACTIVE,
                    daily_limit=Decimal("50000"),
                    monthly_limit=Decimal("200000"),
                )
                db.add(card)

        db.flush()
        print(f"✅ Created cards")

        # ─── Savings Vaults ───────────────────────────────────────
        vault_templates = [
            {"name": "MacBook Fund", "goal_amount": 150000, "color": "#6366F1"},
            {"name": "Europe Trip", "goal_amount": 200000, "color": "#10B981"},
            {"name": "Emergency Fund", "goal_amount": 100000, "color": "#EF4444"},
        ]

        for user in users:
            acc = [a for a in accounts_data if a.user_id == user.id and a.currency == AccountCurrency.INR][0]
            for vt in vault_templates:
                current = random.randint(5000, int(vt["goal_amount"] * 0.6))
                vault = SavingsVault(
                    user_id=user.id,
                    account_id=acc.id,
                    name=vt["name"],
                    goal_amount=Decimal(str(vt["goal_amount"])),
                    current_amount=Decimal(str(current)),
                    color=vt["color"],
                    interest_rate=Decimal("4.50"),
                    description=f"Saving for {vt['name']}",
                )
                db.add(vault)

        db.flush()
        print(f"✅ Created savings vaults")

        # ─── Autonomous Rules ─────────────────────────────────────
        rules_data = [
            {
                "name": "Food savings on low spending weeks",
                "description": "Save ₹500 when weekly food spending is below 80% of average",
                "trigger_condition": {"type": "spending_below_average", "category": "food", "threshold": 0.8},
                "action": {"type": "save_amount", "amount": 500},
                "is_active": True,
            },
            {
                "name": "Daily buffer savings",
                "description": "Save ₹200 when daily spending is below ₹1,500",
                "trigger_condition": {"type": "daily_savings", "min_spending": 1500, "save_amount": 200},
                "action": {"type": "save_amount", "amount": 200},
                "is_active": True,
            },
        ]

        for user in users:
            for rd in rules_data:
                rule = AutonomousRule(
                    user_id=user.id,
                    name=rd["name"],
                    description=rd["description"],
                    trigger_condition=rd["trigger_condition"],
                    action=rd["action"],
                    is_active=rd["is_active"],
                    trigger_count=random.randint(3, 15),
                    last_triggered_at=datetime.utcnow() - timedelta(days=random.randint(1, 10)),
                )
                db.add(rule)

        db.flush()
        print(f"✅ Created autonomous rules")

        # ─── Notifications ───────────────────────────────────────
        notif_templates = [
            ("fraud_alert", "Transaction Alert", "₹8,500 at Amazon — amount is 2x your monthly average", False),
            ("savings", "💰 Auto-Savings: Food savings on low spending weeks", "Saved ₹500 to MacBook Fund. Food spending was 25% below average.", True),
            ("budget", "Budget Alert", "Entertainment spending is 40% above budget this week.", False),
            ("savings", "🎯 Goal Progress!", "You've hit 68% of your Europe Trip goal!", True),
            ("transfer", "Transfer Complete", "₹5,000 transferred to Priya Sharma", True),
        ]

        for user in users:
            for i, (ntype, title, body, is_read) in enumerate(notif_templates):
                notif = Notification(
                    user_id=user.id,
                    type=ntype,
                    title=title,
                    body=body,
                    is_read=is_read,
                    created_at=datetime.utcnow() - timedelta(hours=random.randint(1, 72)),
                )
                db.add(notif)

        db.flush()
        print(f"✅ Created notifications")

        db.commit()
        print("\n🎉 Seed complete!")
        print("\n📋 Demo Credentials:")
        print("   Email: demo@aisb.com")
        print("   Password: password123")
        print("\n📋 Demo Credentials (alt user):")
        print("   Email: priya@example.com")
        print("   Password: password123")


if __name__ == "__main__":
    seed_database()