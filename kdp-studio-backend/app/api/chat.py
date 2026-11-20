import json
from typing import Any, AsyncIterator, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from app.agents.base import AgentContext
from app.core.dependencies import get_current_user_id
from app.core.exception_handlers import AppError
from app.core.runtime import approval_engine, orchestrator
from app.schemas.dto import ChatRequest

router = APIRouter()


@router.post("/message")
async def send_chat_message(
    payload: ChatRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """
    Entry point for Chat-First Agent Orchestration.
    Classifies intent, runs Research + Niche agents, and pauses at WAIT FOR USER APPROVAL.
    """
    ctx = AgentContext(
        user_id=user_id,
        project_id=payload.project_id,
        conversation_id=payload.conversation_id,
    )
    state = await orchestrator.start_workflow(
        user_message=payload.message,
        context=ctx,
        payload={"query": payload.message, "attachments": payload.attachments},
    )
    return {
        "workflow_id": str(state.workflow_id),
        "project_id": str(state.project_id),
        "intent": state.intent,
        "stage": state.current_stage.value,
        "progress_pct": state.progress_pct,
        "task_plan": state.task_plan,
        "pending_approval_id": str(state.pending_approval_id) if state.pending_approval_id else None,
        "token_usage": {
            "prompt_tokens": state.total_prompt_tokens,
            "completion_tokens": state.total_completion_tokens,
            "estimated_cost_usd": state.total_estimated_cost_usd,
        },
        "research_report": state.agent_outputs.get("research_report"),
    }


@router.post("/stream")
async def stream_chat_workflow(
    payload: ChatRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> StreamingResponse:
    """Server-Sent Events (SSE) endpoint streaming workflow stage transitions and approval cards."""
    ctx = AgentContext(
        user_id=user_id,
        project_id=payload.project_id,
        conversation_id=payload.conversation_id,
    )

    async def event_stream() -> AsyncIterator[str]:
        yield f"data: {json.dumps({'event': 'stage', 'stage': 'intent_classification'})}\n\n"
        state = await orchestrator.start_workflow(payload.message, ctx)
        yield f"data: {json.dumps({'event': 'approval_required', 'workflow_id': str(state.workflow_id), 'project_id': str(state.project_id), 'stage': state.current_stage.value, 'pending_approval_id': str(state.pending_approval_id)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/workflows/{workflow_id}/advance/{stage}")
async def advance_workflow_stage(
    workflow_id: UUID,
    stage: str,
    body: Dict[str, Any],
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Resumes a paused workflow ONLY after the project owner has approved the prerequisite checkpoint."""
    try:
        wf = orchestrator.get_workflow(workflow_id)
    except KeyError as exc:
        raise AppError(str(exc), status.HTTP_404_NOT_FOUND, "WORKFLOW_NOT_FOUND") from exc

    if wf.user_id != user_id:
        raise AppError("Forbidden: workflow belongs to another user.", status.HTTP_403_FORBIDDEN, "FORBIDDEN")

    ctx = AgentContext(user_id=user_id, project_id=wf.project_id)
    try:
        if stage == "book_planning":
            wf = await orchestrator.advance_to_book_planning(workflow_id, ctx, body)
        elif stage == "content":
            wf = await orchestrator.advance_to_content_and_illustrations(workflow_id, ctx, body)
        elif stage == "cover_seo_quality":
            wf = await orchestrator.advance_to_cover_seo_and_quality(workflow_id, ctx, body)
        else:
            raise AppError(f"Unknown workflow stage '{stage}'.", status.HTTP_400_BAD_REQUEST, "INVALID_STAGE")
    except RuntimeError as exc:
        raise AppError(str(exc), status.HTTP_409_CONFLICT, "APPROVAL_REQUIRED") from exc

    return {
        "workflow_id": str(wf.workflow_id),
        "project_id": str(wf.project_id),
        "stage": wf.current_stage.value,
        "progress_pct": wf.progress_pct,
        "pending_approval_id": str(wf.pending_approval_id) if wf.pending_approval_id else None,
        "outputs": wf.agent_outputs,
    }


@router.post("/workflows/{workflow_id}/revise/{approval_id}")
async def request_revision_via_chat(
    workflow_id: UUID,
    approval_id: UUID,
    body: Dict[str, Any],
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """Supports requesting revisions directly through chat while preserving previous approval versions."""
    instructions = str(body.get("instructions", "")).strip()
    if not instructions:
        raise AppError("Revision instructions are required.", status.HTTP_400_BAD_REQUEST, "MISSING_INSTRUCTIONS")
    try:
        updated = approval_engine.request_revision(approval_id, user_id, instructions)
    except PermissionError as exc:
        raise AppError(str(exc), status.HTTP_403_FORBIDDEN, "OWNER_REQUIRED") from exc
    except KeyError as exc:
        raise AppError(str(exc), status.HTTP_404_NOT_FOUND, "APPROVAL_NOT_FOUND") from exc

    return {
        "workflow_id": str(workflow_id),
        "approval_id": str(updated.id),
        "state": updated.state.value,
        "version": updated.version,
        "feedback_note": updated.feedback_note,
    }


@router.post("/workflows/{workflow_id}/cancel")
async def cancel_workflow(
    workflow_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    try:
        wf = orchestrator.get_workflow(workflow_id)
    except KeyError as exc:
        raise AppError(str(exc), status.HTTP_404_NOT_FOUND, "WORKFLOW_NOT_FOUND") from exc
    if wf.user_id != user_id:
        raise AppError("Forbidden.", status.HTTP_403_FORBIDDEN, "FORBIDDEN")
    cancelled = orchestrator.cancel_workflow(workflow_id)
    return {"workflow_id": str(cancelled.workflow_id), "stage": cancelled.current_stage.value}
