"""Pydantic Settings — env-driven config."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    port: int = 4000
    log_level: str = "INFO"
    env: str = "development"

    iga_ai_shared_secret: str = Field(default="")
    node_backend_url: str = "http://localhost:3001"

    # Provider primario
    llm_provider: Literal["openai", "anthropic", "gemini"] = "openai"

    # OpenAI (default)
    openai_api_key: str = ""
    openai_model_default: str = "gpt-4o-mini"
    openai_model_fast: str = "gpt-4o-mini"
    openai_model_premium: str = "gpt-4o"
    openai_base_url: str = "https://api.openai.com/v1"

    # Anthropic (fallback)
    anthropic_api_key: str = ""
    anthropic_model_default: str = "claude-sonnet-4-6"
    anthropic_model_fast: str = "claude-haiku-4-5"
    anthropic_model_premium: str = "claude-opus-4-7"

    # Gemini (fallback)
    gemini_api_key: str = ""

    voyage_api_key: str = ""
    voyage_model: str = "voyage-3-large"
    database_url: str = ""

    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = "https://cloud.langfuse.com"
    sentry_dsn: str = ""

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
