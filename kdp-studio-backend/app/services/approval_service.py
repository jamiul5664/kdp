from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4


class ApprovalType(str, Enum):
    RESEARCH = "research_approval"
    NICHE_SELECTION = "niche_selection_approval"
    BOOK_OUTLINE = "book_outline_approval"
    CONTENT = "content_approval"
    ILLUSTRATION = "illustration_approval"
    COVER = "cover_approval"
    FINAL_EXPORT = "final_export_approval"


class ApprovalState(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"


@dataclass
class ApprovalRecord:
    id: UUID
    project_id: UUID
    owner_user_id: UUID
    approval_type: ApprovalType
    agent_name: str
    proposed_output: Dict[str, Any]
    explanation: str
    version: int = 1
    state: ApprovalState = ApprovalState.PENDING
    feedback_note: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None


@dataclass
class ApprovalAuditEntry:
    approval_id: UUID
    actor_user_id: UUID
    action: str
    from_state: str
    to_state: str
    note: Optional[str]
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class ApprovalEngine:
    """Human-in-the-Loop Approval Engine enforcing explicit project-owner sign-off at every checkpoint."""

    def __init__(self) -> None:
        self._records: Dict[UUID, ApprovalRecord] = {}
        self._audit_log: List[ApprovalAuditEntry] = []

    def create_checkpoint(
        self,
        project_id: UUID,
        owner_user_id: UUID,
        approval_type: ApprovalType,
        agent_name: str,
        proposed_output: Dict[str, Any],
        explanation: str,
    ) -> ApprovalRecord:
        existing_versions = [
            r.version
            for r in self._records.values()
            if r.project_id == project_id and r.approval_type == approval_type
        ]
        next_version = max(existing_versions, default=0) + 1
        record = ApprovalRecord(
            id=uuid4(),
            project_id=project_id,
            owner_user_id=owner_user_id,
            approval_type=approval_type,
            agent_name=agent_name,
            proposed_output=proposed_output,
            explanation=explanation,
            version=next_version,
            state=ApprovalState.PENDING,
        )
        self._records[record.id] = record
        self._audit_log.append(
            ApprovalAuditEntry(
                approval_id=record.id,
                actor_user_id=owner_user_id,
                action="checkpoint_created",
                from_state="none",
                to_state=ApprovalState.PENDING.value,
                note=f"v{next_version} proposed by {agent_name}",
            )
        )
        return record

    def _assert_owner(self, record: ApprovalRecord, actor_user_id: UUID) -> None:
        if record.owner_user_id != actor_user_id:
            raise PermissionError("Only the authenticated project owner can approve project outputs.")

    def approve(
        self, approval_id: UUID, actor_user_id: UUID, note: Optional[str] = None
    ) -> ApprovalRecord:
        record = self._get_or_raise(approval_id)
        self._assert_owner(record, actor_user_id)
        prev = record.state.value
        record.state = ApprovalState.APPROVED
        record.approved_at = datetime.now(timezone.utc)
        record.feedback_note = note
        self._audit_log.append(
            ApprovalAuditEntry(record.id, actor_user_id, "approve", prev, record.state.value, note)
        )
        return record

    def reject(
        self, approval_id: UUID, actor_user_id: UUID, reason: str
    ) -> ApprovalRecord:
        record = self._get_or_raise(approval_id)
        self._assert_owner(record, actor_user_id)
        prev = record.state.value
        record.state = ApprovalState.REJECTED
        record.feedback_note = reason
        self._audit_log.append(
            ApprovalAuditEntry(record.id, actor_user_id, "reject", prev, record.state.value, reason)
        )
        return record

    def request_revision(
        self, approval_id: UUID, actor_user_id: UUID, revision_instructions: str
    ) -> ApprovalRecord:
        record = self._get_or_raise(approval_id)
        self._assert_owner(record, actor_user_id)
        prev = record.state.value
        record.state = ApprovalState.REVISION_REQUESTED
        record.feedback_note = revision_instructions
        self._audit_log.append(
            ApprovalAuditEntry(
                record.id, actor_user_id, "request_revision", prev, record.state.value, revision_instructions
            )
        )
        return record

    def is_approved(self, project_id: UUID, approval_type: ApprovalType) -> bool:
        matching = [
            r
            for r in self._records.values()
            if r.project_id == project_id and r.approval_type == approval_type
        ]
        if not matching:
            return False
        latest = max(matching, key=lambda r: r.version)
        return latest.state == ApprovalState.APPROVED

    def require_approval(self, project_id: UUID, approval_type: ApprovalType) -> None:
        """Hard workflow guard: blocks downstream generation until required checkpoint is approved."""
        if not self.is_approved(project_id, approval_type):
            raise RuntimeError(
                f"Blocked: '{approval_type.value}' must be explicitly approved by the project owner "
                f"before downstream generation can start."
            )

    def get_history(self, project_id: UUID, approval_type: Optional[ApprovalType] = None) -> List[ApprovalRecord]:
        items = [
            r
            for r in self._records.values()
            if r.project_id == project_id
            and (approval_type is None or r.approval_type == approval_type)
        ]
        return sorted(items, key=lambda r: (r.approval_type.value, r.version))

    @property
    def audit_log(self) -> List[ApprovalAuditEntry]:
        return list(self._audit_log)

    def _get_or_raise(self, approval_id: UUID) -> ApprovalRecord:
        record = self._records.get(approval_id)
        if not record:
            raise KeyError(f"Approval record {approval_id} not found.")
        return record
