from functools import lru_cache
from typing import List, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "KDP Studio AI Backend"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    secret_key: str = "CHANGE_ME_USE_ENV_SECRET"
    access_token_expire_minutes: int = 60

    # PostgreSQL
    database_url: str = "postgresql+asyncpg://kdp_user:kdp_password@localhost:5432/kdp_studio"
    sync_database_url: str = "postgresql+psycopg2://kdp_user:kdp_password@localhost:5432/kdp_studio"
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # Redis & Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # LLM Model Gateway (Server-side only — never exposed to frontend)
    llm_primary_provider: str = "generic_compatible"
    llm_fallback_provider: str = "openai"
    llm_default_model: str = "gemini-2.5-flash"
    llm_timeout_seconds: float = 45.0
    llm_max_retries: int = 3
    llm_rate_limit_rpm: int = 60

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    generic_llm_api_key: str = ""
    generic_llm_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    gemini_api_key: str = ""

    # Compliant Research Connectors
    amazon_paapi_access_key: str = ""
    amazon_paapi_secret_key: str = ""
    amazon_partner_tag: str = ""
    keyword_api_key: str = ""
    keyword_api_base_url: str = ""
    image_gen_provider: str = "gemini"

    # Storage
    storage_backend: Literal["local", "s3"] = "local"
    local_storage_path: str = "./storage"
    s3_bucket_name: str = ""
    s3_region: str = "us-east-1"

    # CORS
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
