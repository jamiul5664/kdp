from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from uuid import UUID
from app.core.dependencies import get_current_user_id
from app.services.advanced_engines import (
    DurableWorkflowService,
    ProjectMemoryService,
    calculate_kdp_profitability_py,
    can_execute_scheduled_research,
    strip_reviewer_pii,
)

router = APIRouter()

memory_service = ProjectMemoryService()
workflow_service = DurableWorkflowService()


class MemoryCreatePayload(BaseModel):
    project_id: str
    memory_type: str
    title: str
    content: str
    approved: bool = False


class MemoryUpdatePayload(BaseModel):
    content: str
    explicit_override_approved: bool = False


class WorkflowCreatePayload(BaseModel):
    project_id: str
    book_title: str
    idempotency_key: str = Field(..., min_length=4, max_length=120)
    source: str = "chat"


class WorkflowActionPayload(BaseModel):
    action: str
    task_id: str | None = None
    user_approved: bool = False


class ProfitabilityPayload(BaseModel):
    book_format: str = "Paperback"
    trim_size: str = "8.5x11"
    page_count: int = 104
    ink_type: str = "Black & White"
    list_price: float = 12.99
    manual_printing_cost: float | None = None
    production_cost: float = 150.0
    ad_cost_per_sale: float = 1.25


class ScheduleCheckPayload(BaseModel):
    enabled: bool
    user_consent_granted: bool


class ReviewSanitizePayload(BaseModel):
    review_text: str


@router.post("/memory", status_code=status.HTTP_201_CREATED)
async def create_project_memory(
    payload: MemoryCreatePayload,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    try:
        item = memory_service.add_memory(
            memory_id=str(uuid.uuid4()),
            user_id=uid,
            project_id=payload.project_id,
            memory_type=payload.memory_type,
            title=payload.title,
            content=payload.content,
            approved=payload.approved,
            actor=uid,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"id": item.id, "version": item.version, "approval_locked": item.approval_locked}


@router.get("/memory/{project_id}")
async def retrieve_project_memory(
    project_id: str,
    query: str = "",
    top_k: int = 5,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    results = memory_service.retrieve_for_project(
        user_id=str(user_id),
        project_id=project_id,
        query=query or project_id,
        top_k=max(1, min(20, top_k)),
    )
    return {"project_id": project_id, "items": results}


@router.patch("/memory/{memory_id}")
async def update_project_memory(
    memory_id: str,
    payload: MemoryUpdatePayload,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    try:
        item = memory_service.update_memory(
            memory_id=memory_id,
            user_id=uid,
            new_content=payload.content,
            actor=uid,
            explicit_override_approved=payload.explicit_override_approved,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"id": item.id, "version": item.version, "audit_trail": item.audit_trail}


@router.post("/workflows", status_code=status.HTTP_201_CREATED)
async def create_durable_workflow(
    payload: WorkflowCreatePayload,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    run, deduplicated = workflow_service.create_workflow(
        user_id=str(user_id),
        project_id=payload.project_id,
        book_title=payload.book_title,
        idempotency_key=payload.idempotency_key,
        source=payload.source,
    )
    return {"deduplicated": deduplicated, "workflow": run}


@router.post("/workflows/{run_id}/action")
async def workflow_action(
    run_id: str,
    payload: WorkflowActionPayload,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    try:
        if payload.action == "advance" and payload.task_id:
            run = workflow_service.advance_step(
                run_id=run_id,
                user_id=uid,
                task_id=payload.task_id,
                user_approved=payload.user_approved,
            )
        else:
            run = workflow_service.control(run_id=run_id, user_id=uid, action=payload.action)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"workflow": run}


@router.post("/profitability/calculate")
async def calculate_profitability(payload: ProfitabilityPayload) -> dict[str, Any]:
    return calculate_kdp_profitability_py(**payload.model_dump())


@router.post("/reviews/anonymize")
async def anonymize_review(payload: ReviewSanitizePayload) -> dict[str, str]:
    return {"sanitized_text": strip_reviewer_pii(payload.review_text)}


@router.post("/schedules/verify-consent")
async def verify_schedule_consent(payload: ScheduleCheckPayload) -> dict[str, bool]:
    return {
        "allowed": can_execute_scheduled_research(
            enabled=payload.enabled,
            user_consent_granted=payload.user_consent_granted,
        )
    }
