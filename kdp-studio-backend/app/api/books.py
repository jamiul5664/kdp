from typing import Any, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, status
from app.agents.base import AgentContext
from app.core.dependencies import get_current_user_id
from app.core.exception_handlers import AppError
from app.core.runtime import approval_engine, orchestrator
from app.schemas.dto import SeoAuditRequest
from app.services.approval_service import ApprovalType

router = APIRouter()


@router.post("/{project_id}/plan")
async def generate_book_plan(
    project_id: UUID,
    body: Dict[str, Any],
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Generate a structured Book Planner blueprint and create an outline approval checkpoint."""
    ctx = AgentContext(
        user_id=user_id,
        project_id=project_id,
        book_type=str(body.get("book_type", "Coloring Books")),
        target_audience=str(body.get("target_audience", "Adults")),
    )
    res = await orchestrator.planner_agent.run(body, ctx)
    if res.status == "failed":
        raise AppError(res.error or res.summary, status.HTTP_400_BAD_REQUEST, "PLAN_FAILED")

    checkpoint = approval_engine.create_checkpoint(
        project_id=project_id,
        owner_user_id=user_id,
        approval_type=ApprovalType.BOOK_OUTLINE,
        agent_name=res.agent_name,
        proposed_output=res.data,
        explanation="Review and approve book outline before generating page content.",
    )
    return {
        "approval_id": str(checkpoint.id),
        "version": checkpoint.version,
        "summary": res.summary,
        "plan": res.data,
    }


@router.post("/{project_id}/seo-audit")
async def generate_and_audit_seo(
    project_id: UUID,
    payload: SeoAuditRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Run Agent B (KDPSeoAgent) to generate and compliance-check KDP listing metadata."""
    ctx = AgentContext(user_id=user_id, project_id=project_id, target_audience=payload.target_audience)
    res = await orchestrator.seo_agent.run(payload.model_dump(), ctx)
    return {
        "agent": res.agent_name,
        "summary": res.summary,
        "warnings": res.warnings,
        "seo_report": res.data,
    }
