from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from app.agents.base import AgentContext
from app.core.dependencies import get_current_user_id
from app.core.runtime import orchestrator

router = APIRouter()


class NicheScoringRequest(BaseModel):
    candidates: List[Dict[str, Any]] = Field(min_length=1)
    weights: Optional[Dict[str, float]] = None


@router.post("/score")
async def score_and_rank_niches(
    payload: NicheScoringRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Score and rank candidate KDP niches with transparent breakdowns and confidence penalties."""
    ctx = AgentContext(user_id=user_id)
    res = await orchestrator.niche_agent.run(payload.model_dump(), ctx)
    return {
        "agent": res.agent_name,
        "status": res.status,
        "summary": res.summary,
        "ranked_niches": res.data.get("ranked_niches", []),
        "disclaimer": res.data.get("disclaimer"),
    }
