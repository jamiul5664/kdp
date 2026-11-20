from typing import Any, Dict, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, status
from app.core.dependencies import get_current_user_id
from app.core.exception_handlers import AppError
from app.core.runtime import approval_engine
from app.schemas.dto import ApprovalActionRequest
from app.services.approval_service import ApprovalRecord, ApprovalType

router = APIRouter()


def _serialize(record: ApprovalRecord) -> Dict[str, Any]:
    return {
        "id": str(record.id),
        "project_id": str(record.project_id),
        "approval_type": record.approval_type.value,
        "state": record.state.value,
        "version": record.version,
        "agent_name": record.agent_name,
        "explanation": record.explanation,
        "proposed_output": record.proposed_output,
        "feedback_note": record.feedback_note,
        "created_at": record.created_at.isoformat(),
        "approved_at": record.approved_at.isoformat() if record.approved_at else None,
    }


@router.get("/project/{project_id}")
async def list_project_approvals(
    project_id: UUID,
    approval_type: Optional[ApprovalType] = None,
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    history = [
        _serialize(r)
        for r in approval_engine.get_history(project_id, approval_type)
        if r.owner_user_id == user_id
    ]
    return {"project_id": str(project_id), "versions": history}


@router.post("/{approval_id}/action")
async def decide_approval(
    approval_id: UUID,
    payload: ApprovalActionRequest,
    user_id: UUID = Depends(get_current_user_id),
) -> Dict[str, Any]:
    """
    Executes Approve, Reject, or Request Revision.
    Strictly enforces that ONLY the authenticated project owner can approve project outputs.
    """
    try:
        if payload.action == "approve":
            record = approval_engine.approve(approval_id, user_id, note=payload.note)
        elif payload.action == "reject":
            record = approval_engine.reject(approval_id, user_id, reason=payload.note or "Rejected by owner")
        else:
            record = approval_engine.request_revision(
                approval_id, user_id, revision_instructions=payload.note or "Revision requested"
            )
    except PermissionError as exc:
        raise AppError(str(exc), status.HTTP_403_FORBIDDEN, "OWNER_ONLY_APPROVAL") from exc
    except KeyError as exc:
        raise AppError(str(exc), status.HTTP_404_NOT_FOUND, "APPROVAL_NOT_FOUND") from exc

    return _serialize(record)


@router.get("/audit-log")
async def get_approval_audit_log(
    user_id: UUID = Depends(get_current_user_id),
) -> List[Dict[str, Any]]:
    return [
        {
            "approval_id": str(e.approval_id),
            "action": e.action,
            "from_state": e.from_state,
            "to_state": e.to_state,
            "note": e.note,
            "timestamp": e.timestamp.isoformat(),
        }
        for e in approval_engine.audit_log
        if e.actor_user_id == user_id
    ]
