import httpx

from ..config import settings
from .base import ProviderResult


class OpenRouterProvider:
    name = "openrouter"

    @property
    def configured(self) -> bool:
        return bool(settings.openrouter_api_key)

    def generate(self, model: str, prompt: str) -> ProviderResult:
        if not settings.openrouter_api_key:
            raise RuntimeError("OPENROUTER_API_KEY is not configured")

        response = httpx.post(
            f"{settings.openrouter_base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "X-Title": "Sentinel AI Router",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=settings.request_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()

        choices = payload.get("choices") or []
        if not choices:
            raise RuntimeError("OpenRouter returned no choices")

        message = choices[0].get("message") or {}
        content = message.get("content") or ""
        if isinstance(content, list):
            text = "".join(
                item.get("text", "") for item in content if isinstance(item, dict)
            ).strip()
        else:
            text = str(content).strip()

        usage = payload.get("usage") or {}
        return ProviderResult(
            text=text,
            input_tokens=int(usage.get("prompt_tokens") or 0),
            output_tokens=int(usage.get("completion_tokens") or 0),
            model=model,
        )
