from __future__ import annotations

import hashlib
from typing import Any

from app.services.advanced_engines import can_execute_scheduled_research
from app.workers.celery_app import celery_app


@celery_app.task(
    name="app.tasks.batch_tasks.generate_book_page_batch",
    bind=True,
    rate_limit="10/m",
    max_retries=3,
    default_retry_delay=20,
)
def generate_book_page_batch(
    self,
    *,
    job_id: str,
    project_id: str,
    style_profile: dict[str, Any],
    outline_items: list[dict[str, str]],
) -> dict[str, Any]:
    """Rate-limited Celery batch page generator preventing duplicate pages via content hashes."""
    seen_hashes: set[str] = set()
    generated_pages: list[dict[str, Any]] = []

    for idx, item in enumerate(outline_items, start=1):
        title = item.get("title", f"Page {idx}").strip()
        prompt = item.get("prompt", "").strip()
        sig = hashlib.sha256(f"{title.lower()}::{prompt.lower()}".encode("utf-8")).hexdigest()[:16]
        if sig in seen_hashes:
            continue
        seen_hashes.add(sig)
        generated_pages.append(
            {
                "page_number": len(generated_pages) + 1,
                "page_type": item.get("page_type", "Story / Content"),
                "title": title,
                "illustration_prompt": (
                    f"{prompt} | Art style: {style_profile.get('art_style', 'clean print art')} "
                    f"| Line weight: {style_profile.get('line_weight', '2pt')}"
                ),
                "generation_status": "completed",
                "approval_status": "pending_review",
                "version_number": 1,
                "content_hash": sig,
            }
        )

    return {
        "job_id": job_id,
        "project_id": project_id,
        "status": "awaiting_approval",
        "generated_count": len(generated_pages),
        "pages": generated_pages,
    }


@celery_app.task(
    name="app.tasks.batch_tasks.run_scheduled_niche_research",
    bind=True,
    rate_limit="6/m",
    max_retries=2,
)
def run_scheduled_niche_research(
    self,
    *,
    rule_id: str,
    user_id: str,
    query: str,
    enabled: bool,
    user_consent_granted: bool,
) -> dict[str, Any]:
    """Never executes scheduled research without explicit user schedule and permission."""
    if not can_execute_scheduled_research(enabled=enabled, user_consent_granted=user_consent_granted):
        return {
            "rule_id": rule_id,
            "user_id": user_id,
            "executed": False,
            "reason": "Blocked: scheduled research requires explicit user schedule and consent.",
        }
    return {
        "rule_id": rule_id,
        "user_id": user_id,
        "query": query,
        "executed": True,
        "notification_category": "scheduled_research_completed",
    }
