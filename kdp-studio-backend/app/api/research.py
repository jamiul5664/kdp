from typing import Any, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, status
from app.agents.base import AgentContext
from app.core.dependencies import get_current_user_id
from app.core.runtime import orchestrator
from app.schemas.dto import ResearchRequest
from app.tasks.research_tasks import run_market_research_task

router = APIRouter()


@router.post("/run")
async def run_research(
    payload: ResearchRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Run compliant KDP market research synchronously and return structured report with citations."""
    ctx = AgentContext(
        user_id=user_id,
        book_type=payload.category,
        target_audience=payload.target_audience,
        marketplace=payload.marketplace,
    )
    res = await orchestrator.research_agent.run(payload.model_dump(), ctx)
    return {
        "agent": res.agent_name,
        "status": res.status,
        "summary": res.summary,
        "report": res.data,
    }


@router.post("/jobs", status_code=status.HTTP_202_ACCEPTED)
async def enqueue_research_job(
    payload: ResearchRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Queue a long-running compliant market research job via Celery."""
    task = run_market_research_task.delay(
        user_id=str(user_id),
        query=payload.query,
        category=payload.category,
        target_audience=payload.target_audience,
        marketplace=payload.marketplace,
        csv_dataset=payload.csv_dataset,
        weights=payload.weights,
    )
    return {"celery_task_id": task.id, "status": "queued"}
