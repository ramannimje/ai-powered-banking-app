from contextlib import asynccontextmanager
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import settings
from core.database import async_engine, Base
from core import auth, accounts, transactions, ai, fraud, analytics, notifications, autonomous

# Import all models so Base.metadata sees them all
import core.models
import core.models_ai
import core.models_autonomous  # noqa

# Telemetry
try:
    from core.telemetry import metrics_instance, setup_tracing
    HAS_TELEMETRY = True
except Exception:
    HAS_TELEMETRY = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Setup OpenTelemetry tracing
    if HAS_TELEMETRY:
        setup_tracing(app)
    yield
    await async_engine.dispose()


app = FastAPI(
    title="AI Smart Bank API",
    version="1.0.0",
    description="AI-Powered Smart Banking Super App API",
    lifespan=lifespan,
)


# ─── Request Metrics Middleware ──────────────────────────────
class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not HAS_TELEMETRY:
            return await call_next(request)

        start = time.time()
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            duration = time.time() - start

            metrics_instance.http_requests_total.add(1, {
                "method": method,
                "path": path,
                "status_code": str(response.status_code),
            })
            metrics_instance.http_request_duration.record(duration, {
                "method": method,
                "path": path,
                "status_code": str(response.status_code),
            })
            return response
        except Exception:
            raise


app.add_middleware(MetricsMiddleware)

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
app.include_router(autonomous.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-smart-bank"}


@app.get("/metrics")
async def metrics():
    """Prometheus-compatible metrics endpoint."""
    if not HAS_TELEMETRY:
        return {"error": "telemetry not configured"}
    # Return current metrics snapshot as JSON
    # In production, expose via prometheus_client handler
    return {
        "service": "ai-smart-bank",
        "version": "1.0.0",
        "status": "operational",
    }


@app.get("/")
async def root():
    return {
        "message": "AI Smart Bank API",
        "version": "1.0.0",
        "docs": "/docs",
    }