from typing import Any, Dict, List
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, status
from app.agents.base import AgentContext
from app.core.dependencies import get_current_user_id
from app.core.exception_handlers import AppError
from app.core.runtime import approval_engine, book_service, orchestrator
from app.schemas.dto import PageUpsertRequest
from app.services.approval_service import ApprovalType
from app.services.book_service import PageModel

router = APIRouter()


@router.get("/{project_id}")
async def list_project_pages(
    project_id: UUID,
    _user_id: UUID = Depends(get_current_user_id),
) -> List[Dict[str, Any]]:
    pages = book_service.list_pages(project_id)
    return [
        {
            "id": str(p.id),
            "page_number": p.page_number,
            "page_type": p.page_type,
            "content_json": p.content_json,
            "image_asset_id": str(p.image_asset_id) if p.image_asset_id else None,
            "status": p.status,
        }
        for p in pages
    ]


@router.put("/{project_id}")
async def upsert_page(
    project_id: UUID,
    payload: PageUpsertRequest,
    _user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    page = PageModel(
        id=uuid4(),
        project_id=project_id,
        page_number=payload.page_number,
        page_type=payload.page_type,
        content_json=payload.content_json,
        image_asset_id=payload.image_asset_id,
        status="edited",
    )
    saved = book_service.save_page(page)
    return {"id": str(saved.id), "page_number": saved.page_number, "status": saved.status}


@router.post("/{project_id}/generate")
async def generate_pages(
    project_id: UUID,
    body: Dict[str, Any],
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Enforces BOOK_OUTLINE approval before generating book interior pages."""
    try:
        approval_engine.require_approval(project_id, ApprovalType.BOOK_OUTLINE)
    except RuntimeError as exc:
        raise AppError(str(exc), status.HTTP_409_CONFLICT, "OUTLINE_APPROVAL_REQUIRED") from exc

    ctx = AgentContext(
        user_id=user_id,
        project_id=project_id,
        book_type=str(body.get("book_type", "Coloring Books")),
        target_audience=str(body.get("target_audience", "Adults")),
    )
    res = await orchestrator.writing_agent.run(body, ctx)
    checkpoint = approval_engine.create_checkpoint(
        project_id=project_id,
        owner_user_id=user_id,
        approval_type=ApprovalType.CONTENT,
        agent_name=res.agent_name,
        proposed_output=res.data,
        explanation="Approve generated pages before moving to cover and export.",
    )
    return {"approval_id": str(checkpoint.id), "summary": res.summary, "data": res.data}


@router.post("/{project_id}/{page_number}/regenerate")
async def regenerate_single_page(
    project_id: UUID,
    page_number: int,
    body: Dict[str, Any],
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Regenerates an individual page without overwriting other pages in the book."""
    ctx = AgentContext(
        user_id=user_id,
        project_id=project_id,
        book_type=str(body.get("book_type", "Coloring Books")),
        target_audience=str(body.get("target_audience", "Adults")),
    )
    res = await orchestrator.writing_agent.regenerate_page(
        page_number=page_number,
        book_type=ctx.book_type,
        topic=str(body.get("topic", "Original Book")),
        revision_note=str(body.get("revision_note", "")),
        context=ctx,
    )
    return {"summary": res.summary, "data": res.data}
