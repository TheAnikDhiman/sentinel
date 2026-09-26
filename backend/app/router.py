from dataclasses import dataclass
from typing import Literal

from .complexity import ComplexityResult
from .config import settings
from .providers import GeminiProvider, OpenRouterProvider

ProviderOverride = Literal["auto", "gemini", "openrouter"]


@dataclass(frozen=True)
class RoutingDecision:
    provider: str
    model: str
    tier: str
    reasons: list[str]


gemini = GeminiProvider()
openrouter = OpenRouterProvider()


def choose_route(result: ComplexityResult, override: ProviderOverride = "auto") -> RoutingDecision:
    if override == "gemini":
        return RoutingDecision(
            provider="gemini",
            model=settings.gemini_medium_model,
            tier="manual",
            reasons=result.reasons + ["Manual provider override: Gemini"],
        )

    if override == "openrouter":
        return RoutingDecision(
            provider="openrouter",
            model=settings.openrouter_high_model,
            tier="manual",
            reasons=result.reasons + ["Manual provider override: OpenRouter"],
        )

    if result.score >= settings.high_threshold:
        return RoutingDecision(
            provider="openrouter",
            model=settings.openrouter_high_model,
            tier="high",
            reasons=result.reasons + [f"Score reached high threshold ({settings.high_threshold})"],
        )

    if result.score >= settings.medium_threshold:
        return RoutingDecision(
            provider="gemini",
            model=settings.gemini_medium_model,
            tier="medium",
            reasons=result.reasons + [f"Score reached medium threshold ({settings.medium_threshold})"],
        )

    return RoutingDecision(
        provider="gemini",
        model=settings.gemini_low_model,
        tier="low",
        reasons=result.reasons + [f"Score stayed below medium threshold ({settings.medium_threshold})"],
    )


def get_provider(name: str):
    if name == "gemini":
        return gemini
    if name == "openrouter":
        return openrouter
    raise ValueError(f"Unknown provider: {name}")


def fallback_route() -> RoutingDecision:
    return RoutingDecision(
        provider="gemini",
        model=settings.gemini_medium_model,
        tier="fallback",
        reasons=["OpenRouter request failed; fallback to Gemini medium tier"],
    )
