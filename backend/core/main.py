from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.database import async_engine, Base
from core import auth, accounts, transactions, ai, fraud, analytics, notifications

# Import all models so Base.metadata sees them all
import core.models
import core.models_ai  # noqa


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await async_engine.dispose()


app = FastAPI(
    title="AI Smart Bank API",
    version="1.0.0",
    description="AI-Powered Smart Banking Super App API",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(fraud.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-smart-bank"}


@app.get("/")
async def root():
    return {
        "message": "AI Smart Bank API",
        "version": "1.0.0",
        "docs": "/docs",
    }