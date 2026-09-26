from .config import settings


def _cost(input_tokens: int, output_tokens: int, input_rate: float, output_rate: float) -> float:
    return (input_tokens / 1_000_000) * input_rate + (output_tokens / 1_000_000) * output_rate


def estimate_reference_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Paid-equivalent reference cost, not necessarily the user's actual bill."""
    if model == settings.gemini_low_model:
        return _cost(
            input_tokens,
            output_tokens,
            settings.gemini_low_input_usd_per_million,
            settings.gemini_low_output_usd_per_million,
        )
    if model == settings.gemini_medium_model:
        return _cost(
            input_tokens,
            output_tokens,
            settings.gemini_medium_input_usd_per_million,
            settings.gemini_medium_output_usd_per_million,
        )
    if model == settings.openrouter_high_model:
        return _cost(
            input_tokens,
            output_tokens,
            settings.openrouter_high_input_usd_per_million,
            settings.openrouter_high_output_usd_per_million,
        )
    return 0.0


def estimate_baseline_cost(input_tokens: int, output_tokens: int) -> float:
    """Cost estimate if every request were sent to the configured premium baseline."""
    return _cost(
        input_tokens,
        output_tokens,
        settings.baseline_input_usd_per_million,
        settings.baseline_output_usd_per_million,
    )
