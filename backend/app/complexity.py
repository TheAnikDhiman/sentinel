from pydoc import text
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ComplexityResult:
    score: int
    level: str
    task_type: str
    reasons: list[str]


TECHNICAL_TERMS = {
    "algorithm", "api", "architecture", "database", "debug", "docker", "fastapi",
    "javascript", "kubernetes", "machine learning", "python", "react", "sql",
    "system design", "typescript", "optimize", "refactor", "performance",
}

REASONING_TERMS = {
    "analyze", "compare", "derive", "design", "evaluate", "prove", "reason",
    "strategy", "tradeoff", "trade-off", "why", "root cause", "plan",
}

SIMPLE_TERMS = {
    "define", "grammar", "list", "paraphrase", "rewrite", "shorten", "summarize",
    "translate", "correct this", "make concise",
}

SYSTEM_DESIGN_TERMS = {
    "architecture",
    "database",
    "caching",
    "cache",
    "authentication",
    "authorization",
    "rate limiting",
    "queue",
    "queueing",
    "messaging",
    "load balancing",
    "load balancer",
    "sharding",
    "replication",
    "microservices",
    "observability",
    "monitoring",
    "failover",
    "failure handling",
    "fault tolerance",
    "distributed",
    "scalability",
    "scalable",
    "concurrency",
    "cdn",
}

HIGH_SIGNAL_PATTERNS = [
    r"\b(edge cases?|failure modes?|production[- ]ready|scalab(?:le|ility)|distributed system)\b",
    r"\b(step[- ]by[- ]step|multi[- ]step|trade[- ]offs?|benchmark|complexity analysis)\b",
    r"\b(architecture diagram|migration plan|security review|performance bottleneck)\b",
]


def _hits(text: str, terms: set[str]) -> int:
    return sum(1 for term in terms if term in text)


def analyze_complexity(prompt: str, medium_threshold: int = 40, high_threshold: int = 70) -> ComplexityResult:
    text = prompt.lower().strip()
    words = re.findall(r"\b[\w+#.-]+\b", text)
    word_count = len(words)

    score = 10
    reasons: list[str] = []

    if word_count >= 40:
        score += 8
        reasons.append("Longer prompt context")
    if word_count >= 120:
        score += 10
        reasons.append("Large context or instruction set")
    if word_count >= 300:
        score += 8
        reasons.append("Very large prompt")

    instruction_markers = len(
        re.findall(r"(?:\n\s*(?:[-*]|\d+[.)])|\bthen\b|\balso\b|\bfinally\b|\bfirst\b|\bsecond\b)", text)
    )
    if instruction_markers >= 3:
        score += min(14, instruction_markers * 2)
        reasons.append("Multiple instructions detected")

    technical_hits = _hits(text, TECHNICAL_TERMS)
    reasoning_hits = _hits(text, REASONING_TERMS)
    simple_hits = _hits(text, SIMPLE_TERMS)
    system_design_hits = _hits(text, SYSTEM_DESIGN_TERMS)

    if technical_hits:
        score += min(22, 7 + technical_hits * 3)
        reasons.append("Technical or coding task")

    if reasoning_hits:
        score += min(24, 7 + reasoning_hits * 4)
        reasons.append("Reasoning or analysis requested")

    if technical_hits and reasoning_hits:
        score += 6
        reasons.append("Technical task also requires explicit reasoning")
    if system_design_hits >= 2:
        score += min(30, system_design_hits * 4)
    reasons.append(
        f"Multi-component system design task ({system_design_hits} architecture concerns)"
    )

    if re.search(
        r"\b\d[\d,]*(?:\s*(?:k|m|million|thousand))?\s+users?\b",
        text,
    ):
        score += 10
        reasons.append("Large-scale user or traffic requirement detected")

    if (
    "architecture" in text
    and reasoning_hits
    and system_design_hits >= 4
    ):
        score += 8
        reasons.append("Architecture design requires multiple engineering trade-offs")

    if "```" in prompt or re.search(r"\b(class|def|function|select|from|import|interface|async|await)\b", text):
        score += 12
        reasons.append("Code or structured syntax detected")

    high_signal_count = sum(1 for pattern in HIGH_SIGNAL_PATTERNS if re.search(pattern, text))
    if high_signal_count:
        score += min(20, high_signal_count * 8)
        reasons.append("Deep analysis constraints detected")

    if re.search(r"\b(json|yaml|table|schema|strict format|return only)\b", text):
        score += 5
        reasons.append("Structured output requested")

    if simple_hits and score < medium_threshold + 10:
        score -= min(8, simple_hits * 2)
        reasons.append("Straightforward transformation task")

    score = max(0, min(100, score))

    if score >= high_threshold:
        level = "high"
    elif score >= medium_threshold:
        level = "medium"
    else:
        level = "low"

    if technical_hits:
        task_type = "Technical"
    elif reasoning_hits:
        task_type = "Analysis"
    elif simple_hits:
        task_type = "Transformation"
    else:
        task_type = "General"

    if not reasons:
        reasons.append("General-purpose request")

    return ComplexityResult(score=score, level=level, task_type=task_type, reasons=reasons)
