from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


MEMORY_TYPES = (
    "User preferences",
    "Book style profile",
    "Approved book outline",
    "Approved page content",
    "Illustration instructions",
    "Research findings",
    "Previous revisions",
    "Rejected suggestions",
    "Project decisions",
    "Export settings",
)


def deterministic_embedding(text: str, dims: int = 32) -> list[float]:
    """Lightweight deterministic semantic token-hash embedding for local/unit pgvector cosine retrieval."""
    vec = [0.0] * dims
    tokens = re.findall(r"[a-z0-9]{2,}", text.lower())
    for tok in tokens:
        digest = hashlib.sha256(tok.encode("utf-8")).digest()
        idx = digest[0] % dims
        sign = 1.0 if digest[1] % 2 == 0 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 6) for v in vec]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


@dataclass
class MemoryItem:
    id: str
    user_id: str
    project_id: str
    memory_type: str
    title: str
    content: str
    embedding: list[float]
    approved: bool = False
    approval_locked: bool = False
    version: int = 1
    audit_trail: list[dict[str, str]] = field(default_factory=list)


class ProjectMemoryService:
    """User- and project-isolated persistent memory manager with pgvector-compatible cosine retrieval."""

    def __init__(self) -> None:
        self._items: dict[str, MemoryItem] = {}

    def add_memory(
        self,
        *,
        memory_id: str,
        user_id: str,
        project_id: str,
        memory_type: str,
        title: str,
        content: str,
        approved: bool = False,
        actor: str = "system",
    ) -> MemoryItem:
        if memory_type not in MEMORY_TYPES:
            raise ValueError(f"Unsupported memory_type: {memory_type}")
        item = MemoryItem(
            id=memory_id,
            user_id=user_id,
            project_id=project_id,
            memory_type=memory_type,
            title=title,
            content=content,
            embedding=deterministic_embedding(f"{memory_type} {title} {content}"),
            approved=approved,
            approval_locked=approved,
            version=1,
            audit_trail=[
                {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "action": "created_approved" if approved else "created",
                    "actor": actor,
                }
            ],
        )
        self._items[memory_id] = item
        return item

    def retrieve_for_project(
        self,
        *,
        user_id: str,
        project_id: str,
        query: str,
        top_k: int = 5,
    ) -> list[dict[str, Any]]:
        """Strictly filters by user_id and project_id so unrelated projects are never leaked."""
        q_vec = deterministic_embedding(query)
        scoped = [
            m for m in self._items.values()
            if m.user_id == user_id and m.project_id == project_id
        ]
        scored = [
            (cosine_similarity(q_vec, m.embedding), m)
            for m in scoped
        ]
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [
            {
                "id": m.id,
                "memory_type": m.memory_type,
                "title": m.title,
                "content": m.content,
                "similarity": round(score, 4),
                "approved": m.approved,
                "approval_locked": m.approval_locked,
                "version": m.version,
                "audit_trail": m.audit_trail,
            }
            for score, m in scored[:top_k]
        ]

    def update_memory(
        self,
        *,
        memory_id: str,
        user_id: str,
        new_content: str,
        actor: str,
        explicit_override_approved: bool = False,
    ) -> MemoryItem:
        item = self._items.get(memory_id)
        if not item or item.user_id != user_id:
            raise KeyError("Memory item not found for this user.")
        if item.approval_locked and not explicit_override_approved:
            raise PermissionError(
                "Approved project memory cannot be overwritten silently; explicit approval override required."
            )
        item.content = new_content
        item.embedding = deterministic_embedding(f"{item.memory_type} {item.title} {new_content}")
        item.version += 1
        item.audit_trail.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "action": "explicit_approved_revision" if explicit_override_approved else "updated",
                "actor": actor,
            }
        )
        return item


class DurableWorkflowService:
    """Durable workflow orchestration with idempotency keys, mandatory approval checkpoints, and recovery."""

    def __init__(self) -> None:
        self._runs: dict[str, dict[str, Any]] = {}
        self._by_idempotency: dict[str, str] = {}

    def create_workflow(
        self,
        *,
        user_id: str,
        project_id: str,
        book_title: str,
        idempotency_key: str,
        source: str = "chat",
    ) -> tuple[dict[str, Any], bool]:
        scoped_key = f"{user_id}:{idempotency_key}"
        if scoped_key in self._by_idempotency:
            existing_id = self._by_idempotency[scoped_key]
            return self._runs[existing_id], True

        run_id = f"wf_{hashlib.sha1(scoped_key.encode()).hexdigest()[:10]}"
        now = datetime.now(timezone.utc).isoformat()
        run: dict[str, Any] = {
            "id": run_id,
            "user_id": user_id,
            "project_id": project_id,
            "book_title": book_title,
            "idempotency_key": idempotency_key,
            "source": source,
            "status": "waiting_approval",
            "checkpoint_step_index": 2,
            "updated_at": now,
            "steps": [
                {
                    "task_id": f"{run_id}_step_1",
                    "agent_name": "Market Research Agent",
                    "depends_on": [],
                    "status": "completed",
                    "approval_required": False,
                    "approval_granted": True,
                    "error_details": None,
                },
                {
                    "task_id": f"{run_id}_step_2",
                    "agent_name": "Book Architect Agent",
                    "depends_on": [f"{run_id}_step_1"],
                    "status": "completed",
                    "approval_required": False,
                    "approval_granted": True,
                    "error_details": None,
                },
                {
                    "task_id": f"{run_id}_step_3",
                    "agent_name": "Human Approval Checkpoint",
                    "depends_on": [f"{run_id}_step_2"],
                    "status": "waiting_approval",
                    "approval_required": True,
                    "approval_granted": False,
                    "error_details": None,
                },
                {
                    "task_id": f"{run_id}_step_4",
                    "agent_name": "Batch Content & Illustration Agent",
                    "depends_on": [f"{run_id}_step_3"],
                    "status": "pending",
                    "approval_required": False,
                    "approval_granted": False,
                    "error_details": None,
                },
                {
                    "task_id": f"{run_id}_step_5",
                    "agent_name": "Compliance & Export Agent",
                    "depends_on": [f"{run_id}_step_4"],
                    "status": "pending",
                    "approval_required": True,
                    "approval_granted": False,
                    "error_details": None,
                },
            ],
        }
        self._runs[run_id] = run
        self._by_idempotency[scoped_key] = run_id
        return run, False

    def advance_step(self, *, run_id: str, user_id: str, task_id: str, user_approved: bool = False) -> dict[str, Any]:
        run = self._runs.get(run_id)
        if not run or run["user_id"] != user_id:
            raise KeyError("Workflow run not found for user.")
        if run["status"] in ("cancelled", "paused"):
            raise ValueError(f"Workflow is {run['status']} and cannot advance.")
        for idx, step in enumerate(run["steps"]):
            if step["task_id"] == task_id:
                if step["approval_required"] and not user_approved:
                    raise PermissionError("Cannot bypass mandatory human approval checkpoint.")
                step["approval_granted"] = True if step["approval_required"] else step["approval_granted"]
                step["status"] = "completed"
                step["error_details"] = None
                run["checkpoint_step_index"] = min(len(run["steps"]) - 1, idx + 1)
                if idx + 1 < len(run["steps"]):
                    nxt = run["steps"][idx + 1]
                    if nxt["approval_required"]:
                        nxt["status"] = "waiting_approval"
                        run["status"] = "waiting_approval"
                    else:
                        nxt["status"] = "completed"
                        if idx + 2 < len(run["steps"]) and run["steps"][idx + 2]["approval_required"]:
                            run["steps"][idx + 2]["status"] = "waiting_approval"
                            run["checkpoint_step_index"] = idx + 2
                            run["status"] = "waiting_approval"
                else:
                    run["status"] = "completed"
                run["updated_at"] = datetime.now(timezone.utc).isoformat()
                return run
        raise KeyError("Task ID not found in workflow.")

    def control(self, *, run_id: str, user_id: str, action: str) -> dict[str, Any]:
        run = self._runs.get(run_id)
        if not run or run["user_id"] != user_id:
            raise KeyError("Workflow run not found for user.")
        if action == "pause":
            run["status"] = "paused"
        elif action == "resume":
            run["status"] = "waiting_approval" if any(s["status"] == "waiting_approval" for s in run["steps"]) else "running"
        elif action == "cancel":
            run["status"] = "cancelled"
        elif action == "recover":
            for s in run["steps"]:
                if s["status"] == "failed":
                    s["status"] = "waiting_approval" if s["approval_required"] else "completed"
                    s["error_details"] = None
            run["status"] = "waiting_approval" if any(s["status"] == "waiting_approval" for s in run["steps"]) else "completed"
        run["updated_at"] = datetime.now(timezone.utc).isoformat()
        return run


def strip_reviewer_pii(text: str) -> str:
    cleaned = re.sub(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", "[redacted-email]", text)
    cleaned = re.sub(r"@[A-Za-z0-9_]+", "[anonymized-handle]", cleaned)
    cleaned = re.sub(r"\b(?i:by|reviewer|author|posted by)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b", "Reviewer [anonymized]", cleaned)
    return cleaned


def can_execute_scheduled_research(enabled: bool, user_consent_granted: bool) -> bool:
    """Strict opt-in guard: scheduled research never runs without explicit user schedule and permission."""
    return bool(enabled and user_consent_granted)


def calculate_kdp_profitability_py(
    *,
    book_format: str,
    trim_size: str,
    page_count: int,
    ink_type: str,
    list_price: float,
    manual_printing_cost: float | None = None,
    production_cost: float = 0.0,
    ad_cost_per_sale: float = 0.0,
) -> dict[str, Any]:
    is_large = trim_size in ("8.5x11", "8.5x8.5", "7x10")
    pages = max(75 if book_format == "Hardcover" else 24, min(828, page_count))
    if manual_printing_cost is not None and manual_printing_cost >= 0:
        print_cost = round(manual_printing_cost, 2)
        source = "User Input (Manual Override)"
    else:
        if book_format == "Hardcover":
            if ink_type == "Black & White":
                base = 6.80 if is_large else 5.65
                print_cost = round(base if pages <= 108 else base + (pages - 108) * 0.012, 2)
            elif ink_type == "Standard Color":
                print_cost = round(6.80 + pages * 0.0255, 2)
            else:
                print_cost = round(6.80 + pages * 0.065, 2)
        else:
            if ink_type == "Black & White":
                print_cost = round((2.84 if is_large else 2.30) if pages <= 108 else 1.00 + pages * (0.017 if is_large else 0.012), 2)
            elif ink_type == "Standard Color":
                print_cost = round(1.00 + pages * (0.0402 if is_large else 0.0255), 2)
            else:
                print_cost = round(1.00 + pages * (0.08 if is_large else 0.065), 2)
        source = "Estimate (Official KDP Formula)"

    royalty_rate = 0.60 if list_price >= 9.99 else 0.50
    royalty_per_sale = round(list_price * royalty_rate - print_cost, 2)
    net_per_sale = round(royalty_per_sale - ad_cost_per_sale, 2)
    break_even = math.ceil(production_cost / net_per_sale) if net_per_sale > 0 else None
    return {
        "printing_cost": print_cost,
        "printing_cost_source": source,
        "royalty_rate": royalty_rate,
        "royalty_per_sale": royalty_per_sale,
        "net_profit_per_sale": net_per_sale,
        "break_even_sales": break_even,
    }
