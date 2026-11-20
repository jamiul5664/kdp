from typing import Any, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, status
from app.agents.base import AgentContext
from app.core.dependencies import get_current_user_id
from app.core.exception_handlers import AppError
from app.core.runtime import approval_engine, orchestrator, storage_service
from app.schemas.dto import CoverGenerateRequest
from app.services.approval_service import ApprovalType
from app.services.cover_service import CoverCalculationInput, KDPCoverCalculator

router = APIRouter()


@router.post("/calculate")
async def calculate_kdp_cover_dimensions(
    payload: CoverGenerateRequest,
    _user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Pure KDP full-cover geometric calculation (separated from cover design rendering)."""
    try:
        dims = KDPCoverCalculator.calculate(
            CoverCalculationInput(
                trim_width_in=payload.trim_width_in,
                trim_height_in=payload.trim_height_in,
                page_count=payload.page_count,
                paper_type=payload.paper_type,
                ink_type=payload.ink_type,
                bleed=payload.bleed,
                cover_finish=payload.cover_finish,
            )
        )
    except ValueError as exc:
        raise AppError(str(exc), status.HTTP_400_BAD_REQUEST, "INVALID_COVER_SPECS") from exc

    return {
        "front_cover_in": {"width": dims.trim_width_in, "height": dims.trim_height_in},
        "back_cover_in": {"width": dims.trim_width_in, "height": dims.trim_height_in},
        "spine_width_in": dims.spine_width_in,
        "outer_bleed_in": dims.bleed_in,
        "full_wrap_in": {"width": dims.full_width_in, "height": dims.full_height_in},
        "full_wrap_px_300dpi": {"width": dims.full_width_px_300, "height": dims.full_height_px_300},
        "spine_text_allowed": dims.spine_text_allowed,
        "paper_caliper_in": dims.paper_caliper_in,
    }


@router.post("/generate")
async def generate_kdp_full_cover(
    payload: CoverGenerateRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Generates a print-ready full-wrap cover PDF and creates a COVER approval checkpoint."""
    ctx = AgentContext(user_id=user_id, project_id=payload.project_id)
    res = await orchestrator.cover_agent.run(payload.model_dump(), ctx)
    if res.status == "failed":
        raise AppError(res.error or res.summary, status.HTTP_400_BAD_REQUEST, "COVER_GENERATION_FAILED")

    pdf_bytes: bytes = res.data["pdf_bytes"]
    storage_key = f"covers/{payload.project_id}/full_wrap_cover.pdf"
    storage_service.save_bytes(storage_key, pdf_bytes)

    proposed = {
        "storage_key": storage_key,
        "file_size_bytes": res.data["file_size_bytes"],
        "specifications": res.data["specifications"],
        "validation": res.data["validation"],
    }
    checkpoint = approval_engine.create_checkpoint(
        project_id=payload.project_id,
        owner_user_id=user_id,
        approval_type=ApprovalType.COVER,
        agent_name=res.agent_name,
        proposed_output=proposed,
        explanation="Approve full-wrap KDP cover dimensions, typography, and barcode safe area.",
    )
    return {
        "approval_id": str(checkpoint.id),
        "summary": res.summary,
        "warnings": res.warnings,
        **proposed,
    }
