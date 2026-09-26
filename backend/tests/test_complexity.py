from app.complexity import analyze_complexity


def test_simple_prompt_is_low():
    result = analyze_complexity("Rewrite this sentence to be shorter.")
    assert result.level == "low"
    assert result.score < 40


def test_deep_architecture_prompt_is_high():
    prompt = """
    Design a production-ready distributed API architecture for 10 million users.
    Compare trade-offs, failure modes, database sharding, caching, security,
    observability, edge cases, and give a step-by-step migration plan.
    """
    result = analyze_complexity(prompt)
    assert result.level == "high"
    assert result.score >= 70
