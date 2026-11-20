from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class ModelConfiguration:
    provider_name: str
    model_name: str
    timeout_seconds: float = 45.0
    max_retries: int = 3
    input_cost_per_1k_tokens: float = 0.0005
    output_cost_per_1k_tokens: float = 0.0015
    rate_limit_rpm: int = 60
    temperature: float = 0.4


@dataclass(frozen=True)
class LLMMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMResponse:
    text: str
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0
    parsed_json: Optional[Dict[str, Any]] = None
    latency_ms: float = 0.0


@dataclass
class UsageRecord:
    provider: str
    model: str
    agent_name: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float
    latency_ms: float
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    project_id: Optional[str] = None


class UsageTracker:
    """Tracks token consumption and estimated API cost across all agent calls."""

    def __init__(self) -> None:
        self._records: List[UsageRecord] = []

    def record(
        self,
        response: LLMResponse,
        config: ModelConfiguration,
        agent_name: str = "unknown",
        project_id: Optional[str] = None,
    ) -> UsageRecord:
        cost = (
            (response.prompt_tokens / 1000.0) * config.input_cost_per_1k_tokens
            + (response.completion_tokens / 1000.0) * config.output_cost_per_1k_tokens
        )
        response.estimated_cost_usd = round(cost, 6)
        entry = UsageRecord(
            provider=response.provider,
            model=response.model,
            agent_name=agent_name,
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
            total_tokens=response.total_tokens or (response.prompt_tokens + response.completion_tokens),
            estimated_cost_usd=response.estimated_cost_usd,
            latency_ms=response.latency_ms,
            project_id=project_id,
        )
        self._records.append(entry)
        return entry

    def summary(self) -> Dict[str, Any]:
        return {
            "total_calls": len(self._records),
            "total_prompt_tokens": sum(r.prompt_tokens for r in self._records),
            "total_completion_tokens": sum(r.completion_tokens for r in self._records),
            "total_tokens": sum(r.total_tokens for r in self._records),
            "total_estimated_cost_usd": round(sum(r.estimated_cost_usd for r in self._records), 6),
        }

    @property
    def records(self) -> List[UsageRecord]:
        return list(self._records)


class LLMProvider(ABC):
    """Provider-independent abstract LLM interface."""

    name: str

    @abstractmethod
    async def generate_text(
        self,
        messages: List[LLMMessage],
        config: ModelConfiguration,
    ) -> LLMResponse:
        raise NotImplementedError

    @abstractmethod
    async def generate_json(
        self,
        messages: List[LLMMessage],
        config: ModelConfiguration,
        json_schema: Optional[Dict[str, Any]] = None,
    ) -> LLMResponse:
        raise NotImplementedError

    @abstractmethod
    async def stream_text(
        self,
        messages: List[LLMMessage],
        config: ModelConfiguration,
    ) -> AsyncIterator[str]:
        raise NotImplementedError
