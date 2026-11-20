import asyncio
from collections.abc import AsyncIterator
from typing import Any, Dict, List, Optional
import pytest
from app.integrations.llm.base import (
    LLMMessage,
    LLMProvider,
    LLMResponse,
    ModelConfiguration,
    UsageTracker,
)
from app.integrations.llm.router import LLMRouter, RateLimitExceededError


class MockSuccessProvider(LLMProvider):
    name = "mock_primary"

    def __init__(self, fail_times: int = 0, delay_seconds: float = 0.0) -> None:
        self.fail_times = fail_times
        self.delay_seconds = delay_seconds
        self.calls = 0

    async def generate_text(
        self, messages: List[LLMMessage], config: ModelConfiguration
    ) -> LLMResponse:
        self.calls += 1
        if self.delay_seconds > 0:
            await asyncio.sleep(self.delay_seconds)
        if self.calls <= self.fail_times:
            raise RuntimeError("Transient mock failure")
        return LLMResponse(
            text=f"Echo: {messages[-1].content}",
            provider=self.name,
            model=config.model_name,
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150,
        )

    async def generate_json(
        self,
        messages: List[LLMMessage],
        config: ModelConfiguration,
        json_schema: Optional[Dict[str, Any]] = None,
    ) -> LLMResponse:
        self.calls += 1
        if self.calls <= self.fail_times:
            raise RuntimeError("Transient mock JSON failure")
        return LLMResponse(
            text='{"title": "Botanical Coloring Book"}',
            provider=self.name,
            model=config.model_name,
            prompt_tokens=120,
            completion_tokens=40,
            total_tokens=160,
            parsed_json={"title": "Botanical Coloring Book"},
        )

    async def stream_text(
        self, messages: List[LLMMessage], config: ModelConfiguration
    ) -> AsyncIterator[str]:
        for chunk in ["Hello ", "KDP ", "Studio"]:
            yield chunk


class MockFallbackProvider(MockSuccessProvider):
    name = "mock_fallback"


@pytest.mark.asyncio
async def test_text_generation_retry_and_usage_tracking() -> None:
    primary = MockSuccessProvider(fail_times=1)
    tracker = UsageTracker()
    cfg = ModelConfiguration(
        provider_name="mock_primary",
        model_name="test-model",
        max_retries=2,
        input_cost_per_1k_tokens=0.001,
        output_cost_per_1k_tokens=0.002,
    )
    router = LLMRouter(providers={"mock_primary": primary}, default_config=cfg, usage_tracker=tracker)

    resp = await router.generate_text([LLMMessage(role="user", content="Outline book")], agent_name="BookPlannerAgent")
    assert resp.text == "Echo: Outline book"
    assert primary.calls == 2
    summary = tracker.summary()
    assert summary["total_calls"] == 1
    assert summary["total_tokens"] == 150
    assert summary["total_estimated_cost_usd"] == pytest.approx(0.0002, rel=1e-4)


@pytest.mark.asyncio
async def test_structured_json_and_provider_fallback() -> None:
    primary = MockSuccessProvider(fail_times=5)
    fallback = MockFallbackProvider(fail_times=0)
    cfg = ModelConfiguration(provider_name="mock_primary", model_name="test-model", max_retries=2)
    router = LLMRouter(
        providers={"mock_primary": primary, "mock_fallback": fallback},
        default_config=cfg,
        fallback_order=["mock_primary", "mock_fallback"],
    )

    resp = await router.generate_json([LLMMessage(role="user", content="Return JSON")])
    assert resp.provider == "mock_fallback"
    assert resp.parsed_json == {"title": "Botanical Coloring Book"}


@pytest.mark.asyncio
async def test_timeout_triggers_fallback() -> None:
    slow_primary = MockSuccessProvider(delay_seconds=0.3)
    fast_fallback = MockFallbackProvider()
    cfg = ModelConfiguration(
        provider_name="mock_primary",
        model_name="test-model",
        timeout_seconds=0.05,
        max_retries=1,
    )
    router = LLMRouter(
        providers={"mock_primary": slow_primary, "mock_fallback": fast_fallback},
        default_config=cfg,
        fallback_order=["mock_primary", "mock_fallback"],
    )

    resp = await router.generate_text([LLMMessage(role="user", content="Fast check")])
    assert resp.provider == "mock_fallback"


@pytest.mark.asyncio
async def test_streaming_and_rate_limiting() -> None:
    provider = MockSuccessProvider()
    cfg = ModelConfiguration(provider_name="mock_primary", model_name="test-model", rate_limit_rpm=2)
    router = LLMRouter(providers={"mock_primary": provider}, default_config=cfg)

    chunks = [c async for c in router.stream_text([LLMMessage(role="user", content="Stream")])]
    assert "".join(chunks) == "Hello KDP Studio"

    await router.generate_text([LLMMessage(role="user", content="Second allowed call")])
    with pytest.raises(RateLimitExceededError):
        await router.generate_text([LLMMessage(role="user", content="Third call blocked by rate limiter")])
