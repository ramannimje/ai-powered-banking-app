# AI Smart Bank

AI-Powered Smart Banking Super App — a full-stack fintech application with AI financial copilot, fraud detection, budget planner, and autonomous savings agent.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Zustand |
| Backend | Python FastAPI, SQLAlchemy (async), PostgreSQL, Redis, RabbitMQ, Celery |
| AI | OpenAI GPT-4o, LangChain |
| Infrastructure | Docker Compose, Prometheus, Grafana, OpenTelemetry |

## Features

### Core Banking
- Multi-currency accounts (INR, USD, EUR, GBP)
- Transaction ledger with categories
- Virtual card management (freeze/unfreeze)
- Internal & external transfers
- Savings vaults with goal tracking (4.5% APY)

### AI Features
- **Financial Copilot** — Natural language Q&A about your spending (powered by GPT-4o)
- **Budget Planner** — "Can I afford X?" with risk scoring
- **Fraud Detection** — Real-time anomaly detection and auto-blocking
- **Autonomous Finance Agent** — Rule-based auto-saving (e.g., "Save ₹500 when food spending is below average")

### Observability
- OpenTelemetry tracing middleware with request logging
- Prometheus metrics (request rate, latency, business KPIs)
- Grafana dashboards (Overview, Business Metrics, Rule Executions)
- Seed data script with 90 days of realistic transaction history

## Seed Data

```bash
cd backend
python -m scripts.seed_data
```

Creates 2 demo users, accounts, 90 days of transactions, cards, savings vaults, autonomous rules, and notifications.

**Demo credentials:** `demo@aisb.com` / `password123`

## Quick Start

### Prerequisites
- Docker Desktop
- Node.js 18+
- Python 3.12+
- OpenAI API key
- Google OAuth credentials (optional)

### 1. Setup

```bash
# Clone or navigate to project
cd ai-smart-bank

# Copy env file
cp backend/.env.example backend/.env

# Edit backend/.env with your API keys:
#   - OPENAI_API_KEY=sk-your-key
#   - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
#   - JWT_SECRET_KEY (generate with: openssl rand -hex 64)
```

### 2. Start Infrastructure

```bash
docker compose up -d postgres redis rabbitmq
```

### 3. Start Backend

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
uvicorn core.main:app --reload --port 8000
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

### 5. Access the app

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **RabbitMQ Management**: http://localhost:15672 (admin/aisb_secret)

## Project Structure

```
ai-smart-bank/
├── backend/
│   ├── core/           # Config, DB, models, auth, schemas, telemetry
│   ├── services/       # FastAPI route handlers (accounts, transactions, AI, fraud, etc.)
│   ├── workers/        # Celery tasks
│   ├── scripts/        # Seed data, migrations
│   └── requirements.txt
├── frontend/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # UI components
│   └── lib/           # API client, Zustand stores, utils
├── infra/             # Prometheus, Grafana config
├── docker-compose.yml         # Core stack (API, DB, workers)
├── docker-compose.monitoring.yml  # Add Prometheus + Grafana
└── PLAN.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register with email/password |
| POST | /api/auth/login | Login |
| POST | /api/auth/google/callback | Google OAuth callback |
| GET | /api/accounts | List user accounts |
| POST | /api/accounts | Create new account |
| GET | /api/transactions | List transactions (paginated) |
| POST | /api/transactions | Create transaction |
| POST | /api/transactions/transfer | Transfer between accounts |
| GET | /api/vaults | List savings vaults |
| POST | /api/vaults | Create vault |
| POST | /api/vaults/deposit | Deposit to vault |
| GET | /api/cards | List cards |
| POST | /api/cards | Create virtual card |
| POST | /api/cards/freeze | Freeze/unfreeze card |
| POST | /api/ai/chat | AI Financial Copilot chat |
| POST | /api/ai/budget-simulate | Budget simulation |
| GET | /api/analytics/spending | Spending analytics |
| GET | /api/fraud/alerts | Fraud alerts |
| GET | /api/notifications | User notifications |

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Google+ API"
4. Go to Credentials → OAuth 2.0 Client IDs
5. Create Web Application credentials
6. Add redirect URI: `http://localhost:8000/api/auth/google/callback`
7. Add Client ID and Secret to `.env`

## License

MIT