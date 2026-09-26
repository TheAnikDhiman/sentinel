from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Sentinel"
    app_env: str = "development"

    gemini_api_key: str = ""
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    gemini_low_model: str = "gemini-3.5-flash-lite"
    gemini_medium_model: str = "gemini-3.8-flash"
    openrouter_high_model: str = "nvidia/nemotron-3-ultra-550b-a55b:free"

    medium_threshold: int = 40
    high_threshold: int = 70

    database_url: str = "sqlite:///./sentinel.db"
    frontend_origin: str = "http://localhost:3000"

    # Paid-equivalent reference pricing snapshot (USD per 1M tokens).
    # These values are intentionally configurable because provider pricing changes.
    gemini_low_input_usd_per_million: float = 0.30
    gemini_low_output_usd_per_million: float = 2.50
    gemini_medium_input_usd_per_million: float = 0.75
    gemini_medium_output_usd_per_million: float = 3.75
    openrouter_high_input_usd_per_million: float = 0.0
    openrouter_high_output_usd_per_million: float = 0.0

    # Baseline: what every request would cost at the medium Gemini tier.
    baseline_input_usd_per_million: float = 0.75
    baseline_output_usd_per_million: float = 3.75

    request_timeout_seconds: float = 90.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_thresholds(self):
        if not 0 <= self.medium_threshold < self.high_threshold <= 100:
            raise ValueError("Thresholds must satisfy 0 <= medium < high <= 100")
        return self


settings = Settings()
