from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class BookStyleProfile(Base):
    __tablename__ = "book_style_profiles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), unique=True, index=True)
    art_style: Mapped[str] = mapped_column(Text, default="")
    line_weight: Mapped[str] = mapped_column(String(180), default="")
    color_palette: Mapped[list[str]] = mapped_column(JSON, default=list)
    character_descriptions: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    background_style_memory: Mapped[str] = mapped_column(Text, default="")
    illustration_rules: Mapped[str] = mapped_column(Text, default="")
    typography_rules: Mapped[str] = mapped_column(Text, default="")
    page_layout_rules: Mapped[str] = mapped_column(Text, default="")
    writing_tone: Mapped[str] = mapped_column(String(255), default="")
    target_audience: Mapped[str] = mapped_column(String(255), default="")
    approved_page_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(Integer, default=1)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class BatchGenerationJob(Base):
    __tablename__ = "batch_generation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(40), default="queued")
    concurrency_limit: Mapped[int] = mapped_column(Integer, default=2)
    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=10)
    total_pages: Mapped[int] = mapped_column(Integer, default=0)
    completed_pages: Mapped[int] = mapped_column(Integer, default=0)
    failed_pages: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class BatchPageItem(Base):
    __tablename__ = "batch_page_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("batch_generation_jobs.id", ondelete="CASCADE"), index=True)
    page_number: Mapped[int] = mapped_column(Integer)
    page_type: Mapped[str] = mapped_column(String(60), default="Story / Content")
    content: Mapped[str] = mapped_column(Text, default="")
    illustration_prompt: Mapped[str] = mapped_column(Text, default="")
    image_asset_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    generation_status: Mapped[str] = mapped_column(String(40), default="queued")
    approval_status: Mapped[str] = mapped_column(String(40), default="pending_review")
    version_number: Mapped[int] = mapped_column(Integer, default=1)
    content_hash: Mapped[str] = mapped_column(String(64), index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)


class BookTemplate(Base):
    __tablename__ = "book_templates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    book_type: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(180))
    trim_size: Mapped[str] = mapped_column(String(32), default="8.5x11")
    bleed_config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    layout_rules: Mapped[str] = mapped_column(Text, default="")
    page_components: Mapped[list[str]] = mapped_column(JSON, default=list)
    typography: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class AssetProvenance(Base):
    __tablename__ = "asset_provenance"

    asset_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    creation_method: Mapped[str] = mapped_column(String(80))
    provider: Mapped[str] = mapped_column(String(140))
    original_prompt: Mapped[str] = mapped_column(Text, default="")
    source_reference: Mapped[str] = mapped_column(Text, default="")
    license_information: Mapped[str] = mapped_column(Text, default="")
    creation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ComplianceAudit(Base):
    __tablename__ = "compliance_audits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    spec_version: Mapped[str] = mapped_column(String(64), default="KDP-Print-2026.11")
    overall_status: Mapped[str] = mapped_column(String(40), default="Manual Review Required")
    checks_payload: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class PerformanceRecord(Base):
    __tablename__ = "performance_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    report_date: Mapped[str] = mapped_column(String(32))
    book_title: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(120), default="General")
    book_format: Mapped[str] = mapped_column(String(40), default="Paperback")
    marketplace: Mapped[str] = mapped_column(String(40), default="amazon.com")
    units_sold: Mapped[int] = mapped_column(Integer, default=0)
    list_price: Mapped[float] = mapped_column(Float, default=0.0)
    royalty_usd: Mapped[float] = mapped_column(Float, default=0.0)
    ad_spend_usd: Mapped[float] = mapped_column(Float, default=0.0)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ProjectMemory(Base):
    """Persistent AI project memory with pgvector-ready embedding storage and strict user+project isolation."""

    __tablename__ = "project_memories"
    __table_args__ = (
        Index("ix_project_memories_user_project", "user_id", "project_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    memory_type: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    # Stored as float list JSON in portable SQLAlchemy; Alembic migration creates pgvector vector(1536) column in PostgreSQL
    embedding_vector: Mapped[list[float]] = mapped_column(JSON, default=list)
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    approval_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)
    audit_trail: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class WorkflowRun(Base):
    __tablename__ = "workflow_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    source: Mapped[str] = mapped_column(String(40), default="chat")
    status: Mapped[str] = mapped_column(String(40), default="waiting_approval")
    checkpoint_step_index: Mapped[int] = mapped_column(Integer, default=0)
    steps_payload: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ScheduledResearchRule(Base):
    __tablename__ = "scheduled_research_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    query: Mapped[str] = mapped_column(String(255))
    marketplace: Mapped[str] = mapped_column(String(40), default="amazon.com")
    cadence: Mapped[str] = mapped_column(String(32), default="Weekly")
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    user_consent_granted: Mapped[bool] = mapped_column(Boolean, default=False)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class NotificationRecord(Base):
    __tablename__ = "notification_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    channel: Mapped[str] = mapped_column(String(40), default="in_app")
    category: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
