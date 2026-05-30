"""
OpenTelemetry instrumentation for AI Smart Bank.
Wraps FastAPI with tracing, metrics, and structured logging.
"""
import time
import structlog
from functools import wraps

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader, ConsoleMetricExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.trace import Status, StatusCode

# ─── Structured logger ────────────────────────────────────────
logger = structlog.get_logger()

# ─── Tracing Setup ─────────────────────────────────────────────
def setup_tracing(app):
    resource = Resource.create({
        SERVICE_NAME: "ai-smart-bank",
        SERVICE_VERSION: "1.0.0",
        "deployment.environment": "development",
    })

    provider = TracerProvider(resource=resource)
    processor = BatchSpanProcessor(ConsoleSpanExporter())
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)

    # Auto-instrument FastAPI
    FastAPIInstrumentor.instrument_app(app)

    return trace.get_tracer("ai-smart-bank")


# ─── Metrics ─────────────────────────────────────────────────
class AppMetrics:
    def __init__(self):
        resource = Resource.create({SERVICE_NAME: "ai-smart-bank"})
        exporter = ConsoleMetricExporter()
        reader = PeriodicExportingMetricReader(exporter, export_interval_millis=60000)
        provider = MeterProvider(resource=resource, metric_readers=[reader])
        metrics.set_meter_provider(provider)

        self.meter = metrics.get_meter("ai-smart-bank")

        # Request counters
        self.http_requests_total = self.meter.create_counter(
            name="http_requests_total",
            description="Total HTTP requests",
            unit="1",
        )
        self.http_request_duration = self.meter.create_histogram(
            name="http_request_duration_seconds",
            description="HTTP request duration",
            unit="s",
        )

        # Business metrics
        self.transactions_created = self.meter.create_counter(
            name="transactions_created_total",
            description="Total transactions created",
            unit="1",
        )
        self.ai_chats_total = self.meter.create_counter(
            name="ai_chats_total",
            description="Total AI copilot messages",
            unit="1",
        )
        self.rules_triggered = self.meter.create_counter(
            name="autonomous_rules_triggered_total",
            description="Total autonomous rule executions",
            unit="1",
        )
        self.savings_transferred = self.meter.create_counter(
            name="savings_transferred_total",
            description="Total amount saved via autonomous rules",
            unit="INR",
        )
        self.fraud_alerts = self.meter.create_counter(
            name="fraud_alerts_total",
            description="Total fraud alerts generated",
            unit="1",
        )

        # Gauges (via observable)
        self.active_users = self.meter.create_up_down_counter(
            name="active_users_gauge",
            description="Number of active users",
            unit="1",
        )

metrics_instance = AppMetrics()


# ─── Request Logging Middleware ──────────────────────────────
async def metrics_middleware(request, call_next):
    start = time.time()
    method = request.method
    path = request.url.path

    try:
        response = await call_next(request)
        duration = time.time() - start

        # Labels
        labels = {
            "method": method,
            "path": path,
            "status_code": str(response.status_code),
        }

        metrics_instance.http_requests_total.add(1, labels)
        metrics_instance.http_request_duration.record(duration, labels)

        # Log structured
        logger.info(
            "http_request",
            method=method,
            path=path,
            status=response.status_code,
            duration_ms=round(duration * 1000, 2),
            client=request.client.host if request.client else "unknown",
        )

        return response

    except Exception as exc:
        duration = time.time() - start
        logger.error(
            "http_request_error",
            method=method,
            path=path,
            error=str(exc),
            duration_ms=round(duration * 1000, 2),
        )
        raise


# ─── Span helpers ────────────────────────────────────────────
def trace_operation(name: str, attributes: dict = None):
    """Decorator to trace a function or coroutine."""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            tracer = trace.get_tracer("ai-smart-bank")
            with tracer.start_as_current_span(name, attributes=attributes) as span:
                try:
                    result = await func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            tracer = trace.get_tracer("ai-smart-bank")
            with tracer.start_as_current_span(name, attributes=attributes) as span:
                try:
                    result = func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    span.record_exception(e)
                    raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


def record_transaction(category: str, amount: float, currency: str = "INR"):
    """Record a transaction in metrics."""
    metrics_instance.transactions_created.add(1, {
        "category": category,
        "currency": currency,
    })


def record_ai_chat(conversation_id: str, model: str, tokens: int = None):
    """Record an AI chat interaction."""
    metrics_instance.ai_chats_total.add(1, {
        "model": model,
        "conversation_id": conversation_id,
    })


def record_rule_triggered(rule_name: str, amount: float, success: bool):
    """Record an autonomous rule execution."""
    metrics_instance.rules_triggered.add(1, {
        "rule_name": rule_name,
        "success": str(success),
    })
    if success:
        metrics_instance.savings_transferred.add(amount, {"rule_name": rule_name})


def record_fraud_alert(severity: str, blocked: bool):
    """Record a fraud alert."""
    metrics_instance.fraud_alerts.add(1, {
        "severity": severity,
        "blocked": str(blocked),
    })