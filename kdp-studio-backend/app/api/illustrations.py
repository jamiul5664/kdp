from typing import Any, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, status
from app.agents.base import AgentContext
from app.core.dependencies import get_current_user_id
from app.core.exception_handlers import AppError
from app.core.runtime import approval_engine, orchestrator
from app.services.approval_service import ApprovalType

router = APIRouter()


@router.post("/{project_id}/generate")
async def generate_illustrations(
    project_id: UUID,
    body: Dict[str, Any],
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Generate illustrations from approved page briefs with actual pixel DPI verification."""
    try:
        approval_engine.require_approval(project_id, ApprovalType.BOOK_OUTLINE)
    except RuntimeError as exc:
        raise AppError(str(exc), status.HTTP_409_CONFLICT, "OUTLINE_APPROVAL_REQUIRED") from exc

    ctx = AgentContext(user_id=user_id, project_id=project_id)
    res = await orchestrator.illustration_agent.run(body, ctx)
    checkpoint = approval_engine.create_checkpoint(
        project_id=project_id,
        owner_user_id=user_id,
        approval_type=ApprovalType.ILLUSTRATION,
        agent_name=res.agent_name,
        proposed_output=res.data,
        explanation="Review pixel-verified illustrations and art direction consistency before export.",
    )
    return {
        "approval_id": str(checkpoint.id),
        "summary": res.summary,
        "warnings": res.warnings,
        "data": res.data,
    }


@router.get("/assets")
async def list_illustration_assets(
    _user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    assets = orchestrator.illustration_agent.engine.library.list_assets()
    return {
        "count": len(assets),
        "assets": [
            {
                "asset_id": a.asset_id,
                "provider_id": a.provider_id,
                "model_name": a.model_name,
                "illustration_type": a.illustration_type,
                "version": a.version,
                "sha256_hash": a.sha256_hash,
                "is_duplicate": a.is_duplicate,
                "width_px": a.resolution.width_px,
                "height_px": a.resolution.height_px,
                "meets_300_dpi": a.resolution.meets_300_dpi,
            }
            for a in assets
        ],
    }
