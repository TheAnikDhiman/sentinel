from collections import Counter
from time import perf_counter

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .complexity import analyze_complexity
from .config import settings
from .costs import estimate_baseline_cost, estimate_reference_cost
from .database import Base, engine, get_db
from .models import RequestLog
from .router import choose_route, fallback_route, gemini, get_provider, openrouter
from .schemas import ChatRequest, ChatResponse, SettingsResponse, SettingsUpdate


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sentinel API",
    version="2.0.0",
    description="Complexity-aware routing between Gemini and OpenRouter.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"name": "Sentinel API", "version": "2.0.0", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "sentinel"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(body: ChatRequest, db: Session = Depends(get_db)):
    complexity = analyze_complexity(
        body.message,
        medium_threshold=settings.medium_threshold,
        high_threshold=settings.high_threshold,
    )
    decision = choose_route(complexity, body.provider)
    provider = get_provider(decision.provider)
    routing_reasons = list(decision.reasons)
    used_fallback = False

    started = perf_counter()
    try:
        result = provider.generate(decision.model, body.message)
    except Exception as exc:
        # Automatic high-tier routing has one transparent fallback to Gemini.
        if body.provider == "auto" and decision.provider == "openrouter":
            fallback = fallback_route()
            try:
                result = gemini.generate(fallback.model, body.message)
                decision = fallback
                provider = gemini
                routing_reasons.append(f"OpenRouter error: {type(exc).__name__}")
                routing_reasons.extend(fallback.reasons)
                used_fallback = True
            except Exception as fallback_exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"OpenRouter failed and Gemini fallback also failed: {fallback_exc}",
                ) from fallback_exc
        else:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    latency_ms = round((perf_counter() - started) * 1000, 1)
    reference_cost = estimate_reference_cost(result.model, result.input_tokens, result.output_tokens)
    baseline_cost = estimate_baseline_cost(result.input_tokens, result.output_tokens)
    savings = max(0.0, baseline_cost - reference_cost)

    row = RequestLog(
        prompt=body.message,
        response=result.text,
        provider=provider.name,
        model=result.model,
        tier=decision.tier,
        complexity_score=complexity.score,
        task_type=complexity.task_type,
        routing_reason="\n".join(routing_reasons),
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        reference_cost=reference_cost,
        baseline_cost=baseline_cost,
        estimated_savings=savings,
        latency_ms=latency_ms,
        used_fallback=used_fallback,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return ChatResponse(
        id=row.id,
        response=row.response,
        provider=row.provider,
        model=row.model,
        tier=row.tier,
        complexity=row.complexity_score,
        task_type=row.task_type,
        routing_reason=routing_reasons,
        input_tokens=row.input_tokens,
        output_tokens=row.output_tokens,
        reference_cost=row.reference_cost,
        baseline_cost=row.baseline_cost,
        estimated_savings=row.estimated_savings,
        latency_ms=row.latency_ms,
        used_fallback=row.used_fallback,
        created_at=row.created_at,
    )


@app.get("/api/history")
def history(limit: int = 50, db: Session = Depends(get_db)):
    limit = min(max(limit, 1), 200)
    rows = db.scalars(select(RequestLog).order_by(RequestLog.created_at.desc()).limit(limit)).all()
    return [
        {
            "id": row.id,
            "prompt": row.prompt,
            "response": row.response,
            "provider": row.provider,
            "model": row.model,
            "tier": row.tier,
            "complexity": row.complexity_score,
            "task_type": row.task_type,
            "routing_reason": row.routing_reason.splitlines(),
            "input_tokens": row.input_tokens,
            "output_tokens": row.output_tokens,
            "reference_cost": row.reference_cost,
            "baseline_cost": row.baseline_cost,
            "savings": row.estimated_savings,
            "latency_ms": row.latency_ms,
            "used_fallback": row.used_fallback,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@app.get("/api/analytics")
def analytics(db: Session = Depends(get_db)):
    rows = db.scalars(select(RequestLog).order_by(RequestLog.created_at.asc())).all()
    total = len(rows)
    reference_spend = sum(row.reference_cost for row in rows)
    baseline_spend = sum(row.baseline_cost for row in rows)
    savings = sum(row.estimated_savings for row in rows)
    avg_complexity = round(sum(row.complexity_score for row in rows) / total, 1) if total else 0.0
    provider_counts = Counter(row.provider for row in rows)
    tier_counts = Counter(row.tier for row in rows)

    daily: dict[str, dict] = {}
    for row in rows:
        key = row.created_at.strftime("%b %d")
        daily.setdefault(
            key,
            {"date": key, "reference_cost": 0.0, "baseline_cost": 0.0, "savings": 0.0, "requests": 0},
        )
        daily[key]["reference_cost"] += row.reference_cost
        daily[key]["baseline_cost"] += row.baseline_cost
        daily[key]["savings"] += row.estimated_savings
        daily[key]["requests"] += 1

    return {
        "total_requests": total,
        "reference_spend": round(reference_spend, 8),
        "baseline_spend": round(baseline_spend, 8),
        "estimated_savings": round(savings, 8),
        "average_complexity": avg_complexity,
        "provider_usage": dict(provider_counts),
        "tier_usage": dict(tier_counts),
        "fallback_count": sum(1 for row in rows if row.used_fallback),
        "timeline": list(daily.values())[-14:],
    }


@app.get("/api/providers")
def providers():
    return [
        {
            "name": "Gemini",
            "id": "gemini",
            "configured": gemini.configured,
            "models": [settings.gemini_low_model, settings.gemini_medium_model],
        },
        {
            "name": "OpenRouter",
            "id": "openrouter",
            "configured": openrouter.configured,
            "models": [settings.openrouter_high_model],
        },
    ]


@app.get("/api/settings", response_model=SettingsResponse)
def get_settings():
    return SettingsResponse(
        medium_threshold=settings.medium_threshold,
        high_threshold=settings.high_threshold,
        gemini_low_model=settings.gemini_low_model,
        gemini_medium_model=settings.gemini_medium_model,
        openrouter_high_model=settings.openrouter_high_model,
    )


@app.put("/api/settings", response_model=SettingsResponse)
def update_settings(body: SettingsUpdate):
    # Runtime-only in this portfolio MVP. Persist to DB/config service in production.
    settings.medium_threshold = body.medium_threshold
    settings.high_threshold = body.high_threshold
    return get_settings()
