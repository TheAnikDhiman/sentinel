import httpx

from ..config import settings
from .base import ProviderResult


class GeminiProvider:
    name = "gemini"

    @property
    def configured(self) -> bool:
        return bool(settings.gemini_api_key)

    def generate(self, model: str, prompt: str) -> ProviderResult:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        response = httpx.post(
            url,
            headers={
                "x-goog-api-key": settings.gemini_api_key,
                "Content-Type": "application/json",
            },
            json={
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": prompt}],
                    }
                ]
            },
            timeout=settings.request_timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()

        candidates = payload.get("candidates") or []
        if not candidates:
            block_reason = (payload.get("promptFeedback") or {}).get("blockReason")
            raise RuntimeError(f"Gemini returned no candidates{f' ({block_reason})' if block_reason else ''}")

        parts = ((candidates[0].get("content") or {}).get("parts") or [])
        text = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()

        usage = payload.get("usageMetadata") or {}
        input_tokens = int(usage.get("promptTokenCount") or 0)
        visible_output = int(usage.get("candidatesTokenCount") or 0)
        thinking_tokens = int(usage.get("thoughtsTokenCount") or 0)

        return ProviderResult(
            text=text,
            input_tokens=input_tokens,
            output_tokens=visible_output + thinking_tokens,
            model=model,
        )
