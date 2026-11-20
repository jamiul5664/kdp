import asyncio
from typing import Any, Dict, Optional
from uuid import UUID
from app.agents.base import AgentContext
from app.agents.research_agent import ResearchAgent
from app.integrations.llm.router import get_default_llm_router
from app.workers.celery_app import celery_app


@celery_app.task(
    name="app.tasks.research_tasks.run_market_research_task",
    bind=True,
    max_retries=3,
    default_retry_delay=15,
)
def run_market_research_task(
    self: Any,
    user_id: str,
    query: str,
    category: str = "All Categories",
    target_audience: str = "General",
    marketplace: str = "amazon.com",
    csv_dataset: Optional[str] = None,
    weights: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    """Long-running Celery task executing compliant KDP market research connectors."""
    try:
        agent = ResearchAgent(get_default_llm_router())
        ctx = AgentContext(
            user_id=UUID(user_id),
            book_type=category,
            target_audience=target_audience,
            marketplace=marketplace,
        )
        result = asyncio.run(
            agent.run(
                {
                    "query": query,
                    "category": category,
                    "target_audience": target_audience,
                    "marketplace": marketplace,
                    "csv_dataset": csv_dataset,
                    "weights": weights,
                },
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
