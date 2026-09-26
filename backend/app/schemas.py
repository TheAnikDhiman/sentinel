from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


ProviderName = Literal["auto", "gemini", "openrouter"]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=30_000)
    provider: ProviderName = "auto"


class ChatResponse(BaseModel):
    id: int
    response: str
    provider: str
    model: str
    tier: str
    complexity: int
    task_type: str
    routing_reason: list[str]
    input_tokens: int
    output_tokens: int
    reference_cost: float
    baseline_cost: float
    estimated_savings: float
    latency_ms: float
    used_fallback: bool
    created_at: datetime


class SettingsUpdate(BaseModel):
    medium_threshold: int = Field(ge=5, le=90)
    high_threshold: int = Field(ge=10, le=95)

    @model_validator(mode="after")
    def validate_thresholds(self):
        if self.medium_threshold >= self.high_threshold:
            raise ValueError("medium_threshold must be less than high_threshold")
        return self


class SettingsResponse(BaseModel):
    medium_threshold: int
    high_threshold: int
    gemini_low_model: str
    gemini_medium_model: str
    openrouter_high_model: str
