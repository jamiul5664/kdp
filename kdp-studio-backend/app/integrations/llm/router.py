import asyncio
import logging
import time
from collections import deque
from collections.abc import AsyncIterator
from typing import Any, Deque, Dict, List, Optional
from app.core.config import get_settings
from app.integrations.llm.base import (
    LLMMessage,
    LLMProvider,
    LLMResponse,
    ModelConfiguration,
    UsageTracker,
)
from app.integrations.llm.generic_provider import GenericCompatibleProvider
from app.integrations.llm.openai_provider import OpenAIProvider

logger = logging.getLogger("kdp_studio.llm_router")


class RateLimitExceededError(RuntimeError):
    """Raised when configured per-minute rate limit is exceeded."""


class SlidingWindowRateLimiter:
    def __init__(self, max_requests_per_minute: int) -> None:
        self._limit = max(1, max_requests_per_minute)
        self._timestamps: Deque[float] = deque()

    def acquire(self) -> None:
        now = time.monotonic()
        while self._timestamps and (now - self._timestamps[0]) > 60.0:
            self._timestamps.popleft()
        if len(self._timestamps) >= self._limit:
            raise RateLimitExceededError(
                f"LLM Gateway rate limit exceeded ({self._limit} requests/min)."
            )
        self._timestamps.append(now)


class LLMRouter:
    """Central AI Model Gateway handling retries, timeouts, rate limiting, fallback, and cost tracking."""

    def __init__(
        self,
        providers: Dict[str, LLMProvider],
        default_config: ModelConfiguration,
        fallback_order: Optional[List[str]] = None,
        usage_tracker: Optional[UsageTracker] = None,
    ) -> None:
        self._providers = providers
        self.default_config = default_config
        self._fallback_order = fallback_order or list(providers.keys())
        self.usage_tracker = usage_tracker or UsageTracker()
        self._limiter = SlidingWindowRateLimiter(default_config.rate_limit_rpm)

    def _ordered_provider_names(self, preferred: str) -> List[str]:
        names = [preferred] if preferred in self._providers else []
        for name in self._fallback_order:
            if name in self._providers and name not in names:
                names.append(name)
        return names

    async def generate_text(
        self,
        messages: List[LLMMessage],
        config: Optional[ModelConfiguration] = None,
        agent_name: str = "orchestrator",
        project_id: Optional[str] = None,
    ) -> LLMResponse:
        cfg = config or self.default_config
        self._limiter.acquire()
        last_error: Optional[Exception] = None

        for provider_name in self._ordered_provider_names(cfg.provider_name):
            provider = self._providers[provider_name]
            for attempt in range(1, cfg.max_retries + 1):
                try:
                    response = await asyncio.wait_for(
                        provider.generate_text(messages, cfg),
                        timeout=cfg.timeout_seconds,
                    )
                    self.usage_tracker.record(response, cfg, agent_name=agent_name, project_id=project_id)
                    return response
                except Exception as exc:
                    last_error = exc
                    logger.warning(
                        "LLM text call failed (provider=%s attempt=%d/%d): %s",
                        provider_name,
                        attempt,
                        cfg.max_retries,
                        exc,
                    )
                    if attempt < cfg.max_retries:
                        await asyncio.sleep(min(0.2 * (2 ** (attempt - 1)), 2.0))

        raise RuntimeError(f"All configured LLM providers failed: {last_error}")

    async def generate_json(
        self,
        messages: List[LLMMessage],
        json_schema: Optional[Dict[str, Any]] = None,
        config: Optional[ModelConfiguration] = None,
        agent_name: str = "orchestrator",
        project_id: Optional[str] = None,
    ) -> LLMResponse:
        cfg = config or self.default_config
        self._limiter.acquire()
        last_error: Optional[Exception] = None

        for provider_name in self._ordered_provider_names(cfg.provider_name):
            provider = self._providers[provider_name]
            for attempt in range(1, cfg.max_retries + 1):
                try:
                    response = await asyncio.wait_for(
                        provider.generate_json(messages, cfg, json_schema=json_schema),
                        timeout=cfg.timeout_seconds,
                    )
                    self.usage_tracker.record(response, cfg, agent_name=agent_name, project_id=project_id)
                    return response
                except Exception as exc:
                    last_error = exc
                    logger.warning(
                        "LLM JSON call failed (provider=%s attempt=%d/%d): %s",
                        provider_name,
                        attempt,
                        cfg.max_retries,
                        exc,
                    )
                    if attempt < cfg.max_retries:
                        await asyncio.sleep(min(0.2 * (2 ** (attempt - 1)), 2.0))

        raise RuntimeError(f"All configured LLM providers failed for JSON output: {last_error}")

    async def stream_text(
        self,
        messages: List[LLMMessage],
        config: Optional[ModelConfiguration] = None,
    ) -> AsyncIterator[str]:
        cfg = config or self.default_config
        self._limiter.acquire()
        last_error: Optional[Exception] = None

        for provider_name in self._ordered_provider_names(cfg.provider_name):
            provider = self._providers[provider_name]
            try:
                async for token in provider.stream_text(messages, cfg):
                    yield token
                return
            except Exception as exc:
                last_error = exc
                logger.warning("LLM stream failed on provider=%s: %s", provider_name, exc)

        raise RuntimeError(f"All configured LLM providers failed to stream: {last_error}")


_default_router: Optional[LLMRouter] = None


def get_default_llm_router() -> LLMRouter:
    global _default_router
    if _default_router is None:
        settings = get_settings()
        generic_key = settings.generic_llm_api_key or settings.gemini_api_key
        providers: Dict[str, LLMProvider] = {
            "generic_compatible": GenericCompatibleProvider(
                api_key=generic_key,
                base_url=settings.generic_llm_base_url,
            ),
            "openai": OpenAIProvider(
                api_key=settings.openai_api_key,
                base_url=settings.openai_base_url,
            ),
        }
        default_cfg = ModelConfiguration(
            provider_name=settings.llm_primary_provider,
            model_name=settings.llm_default_model,
            timeout_seconds=settings.llm_timeout_seconds,
            max_retries=settings.llm_max_retries,
            rate_limit_rpm=settings.llm_rate_limit_rpm,
        )
        _default_router = LLMRouter(
            providers=providers,
            default_config=default_cfg,
            fallback_order=[settings.llm_primary_provider, settings.llm_fallback_provider],
        )
    return _default_router
