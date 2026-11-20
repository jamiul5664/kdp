from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID
from app.integrations.llm.base import LLMMessage, LLMResponse, ModelConfiguration
from app.integrations.llm.router import LLMRouter


@dataclass
class AgentContext:
    """Shared typed project and session context passed into every specialized agent."""

    user_id: UUID
    project_id: Optional[UUID] = None
    conversation_id: Optional[UUID] = None
    book_type: str = "Coloring Books"
    target_audience: str = "Adults"
    marketplace: str = "amazon.com"
    language: str = "en"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    """Typed output contract returned by every specialized agent."""

    agent_name: str
    status: str  # "completed" | "failed" | "waiting_approval" | "cancelled"
    summary: str
    data: Dict[str, Any] = field(default_factory=dict)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    estimated_cost_usd: float = 0.0
    warnings: List[str] = field(default_factory=list)
    error: Optional[str] = None
    completed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class BaseAgent(ABC):
    """
    Base class for all 10 specialized KDP Studio agents.
    Every agent calls LLMRouter (the AI Model Gateway) and never calls provider SDKs directly.
    """

    name: str = "BaseAgent"

    def __init__(self, llm_router: LLMRouter) -> None:
        self.llm = llm_router

    async def _call_gateway_json(
        self,
        system_prompt: str,
        user_prompt: str,
        context: AgentContext,
        config: Optional[ModelConfiguration] = None,
        json_schema: Optional[Dict[str, Any]] = None,
    ) -> Optional[LLMResponse]:
        """Helper invoking the AI Model Gateway safely; returns None if no live provider key is configured."""
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt),
        ]
        try:
            return await self.llm.generate_json(
                messages=messages,
                json_schema=json_schema,
                config=config,
                agent_name=self.name,
                project_id=str(context.project_id) if context.project_id else None,
            )
        except Exception:
            return None

    async def _call_gateway_text(
        self,
        system_prompt: str,
        user_prompt: str,
        context: AgentContext,
        config: Optional[ModelConfiguration] = None,
    ) -> Optional[LLMResponse]:
        messages = [
            LLMMessage(role="system", content=system_prompt),
            LLMMessage(role="user", content=user_prompt),
        ]
        try:
            return await self.llm.generate_text(
                messages=messages,
                config=config,
                agent_name=self.name,
                project_id=str(context.project_id) if context.project_id else None,
            )
        except Exception:
            return None

    @abstractmethod
    async def run(self, payload: Dict[str, Any], context: AgentContext) -> AgentResult:
        raise NotImplementedError
