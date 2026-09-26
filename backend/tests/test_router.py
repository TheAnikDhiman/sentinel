from app.complexity import ComplexityResult
from app.router import choose_route


def result(score: int, level: str):
    return ComplexityResult(score=score, level=level, task_type="General", reasons=["test"])


def test_low_routes_to_gemini():
    decision = choose_route(result(20, "low"))
    assert decision.provider == "gemini"
    assert decision.tier == "low"


def test_high_routes_to_openrouter():
    decision = choose_route(result(85, "high"))
    assert decision.provider == "openrouter"
    assert decision.tier == "high"
