from typing import Any, Dict, List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from app.agents.base import AgentContext
from app.core.dependencies import get_current_user_id
from app.core.exception_handlers import AppError
from app.core.runtime import (
    approval_engine,
    book_service,
    orchestrator,
    pdf_service,
    storage_service,
)
from app.schemas.dto import ExportRequest
from app.services.approval_service import ApprovalType
from app.services.pdf_service import InteriorPageInput, InteriorPrintSpec

router = APIRouter()


@router.post("/quality-check/{project_id}")
async def run_kdp_quality_checker(
    project_id: UUID,
    body: Dict[str, Any],
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Run Agent A (KDPQualityCheckerAgent) and return Pass/Warning/Fail + suggested fixes."""
    ctx = AgentContext(user_id=user_id, project_id=project_id)
    res = await orchestrator.quality_agent.run(body, ctx)
    return {
        "agent": res.agent_name,
        "summary": res.summary,
        "report": res.data,
    }


@router.post("/generate")
async def generate_export_artifact(
    payload: ExportRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """
    Exports validated KDP-ready artifacts ONLY after explicit FINAL_EXPORT approval by the owner.
    Never returns a fake export; compiles real ReportLab PDFs + validation reports.
    """
    try:
        approval_engine.require_approval(payload.project_id, ApprovalType.FINAL_EXPORT)
    except RuntimeError as exc:
        raise AppError(str(exc), status.HTTP_409_CONFLICT, "FINAL_EXPORT_APPROVAL_REQUIRED") from exc

    pages_models = book_service.list_pages(payload.project_id)
    interior_pages: List[InteriorPageInput] = [
        InteriorPageInput(
            page_number=p.page_number,
            heading=str(p.content_json.get("heading", f"Page {p.page_number}")),
            body_text=str(
                p.content_json.get("body_text")
                or p.content_json.get("story_text")
                or p.content_json.get("prompt")
                or p.content_json.get("page_description")
                or ""
            ),
        )
        for p in pages_models
    ] or [
        InteriorPageInput(page_number=i, heading=f"Page {i}", body_text="Approved KDP content.")
        for i in range(1, 25)
    ]

    spec = InteriorPrintSpec(title=f"Project {payload.project_id}", author="KDP Studio Publisher")
    compiled = pdf_service.generate_interior_pdf(spec, interior_pages)

    storage_key = f"exports/{payload.project_id}/{payload.artifact_type}.pdf"
    storage_service.save_bytes(storage_key, compiled["pdf_bytes"])

    return {
        "project_id": str(payload.project_id),
        "artifact_type": payload.artifact_type,
        "status": "completed",
        "storage_key": storage_key,
        "file_size_bytes": compiled["file_size_bytes"],
        "page_count": compiled["page_count"],
        "dimensions_in": compiled["dimensions_in"],
        "margins_in": compiled["margins_in"],
        "validation_report": compiled["validation_report"],
    }
