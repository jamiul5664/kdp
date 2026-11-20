import asyncio
from typing import Any, Dict, List
from uuid import UUID
from app.agents.base import AgentContext
from app.agents.illustration_agent import IllustrationAgent
from app.agents.writing_agent import WritingAgent
from app.integrations.llm.router import get_default_llm_router
from app.workers.celery_app import celery_app


@celery_app.task(
    name="app.tasks.book_tasks.generate_book_pages_task",
    bind=True,
    max_retries=3,
    default_retry_delay=20,
)
def generate_book_pages_task(
    self: Any,
    user_id: str,
    project_id: str,
    book_type: str,
    topic: str,
    page_numbers: List[int],
    target_audience: str = "Adults",
) -> Dict[str, Any]:
    """Long-running Celery task generating structured pages via WritingAgent."""
    try:
        agent = WritingAgent(get_default_llm_router())
        ctx = AgentContext(
            user_id=UUID(user_id),
            project_id=UUID(project_id),
            book_type=book_type,
            target_audience=target_audience,
        )
        result = asyncio.run(
            agent.run(
                {"book_type": book_type, "topic": topic, "page_numbers": page_numbers},
                ctx,
            )
        )
        return {
            "status": result.status,
            "summary": result.summary,
            "data": result.data,
            "prompt_tokens": result.prompt_tokens,
            "completion_tokens": result.completion_tokens,
            "estimated_cost_usd": result.estimated_cost_usd,
        }
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    name="app.tasks.book_tasks.generate_illustrations_task",
    bind=True,
    max_retries=2,
    default_retry_delay=20,
)
def generate_illustrations_task(
    self: Any,
    user_id: str,
    project_id: str,
    page_briefs: List[Dict[str, Any]],
    illustration_type: str = "coloring",
    target_width_in: float = 8.5,
    target_height_in: float = 11.0,
) -> Dict[str, Any]:
    """Long-running Celery task generating verified 300 DPI print illustrations."""
    try:
        agent = IllustrationAgent(get_default_llm_router())
        ctx = AgentContext(user_id=UUID(user_id), project_id=UUID(project_id))
        result = asyncio.run(
            agent.run(
                {
                    "page_briefs": page_briefs,
                    "illustration_type": illustration_type,
                    "target_width_in": target_width_in,
                    "target_height_in": target_height_in,
                },
                ctx,
            )
        )
        return {
            "status": result.status,
            "summary": result.summary,
            "data": result.data,
            "warnings": result.warnings,
        }
    except Exception as exc:
        raise self.retry(exc=exc)
