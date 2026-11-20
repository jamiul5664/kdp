from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


# 1. users
class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    imprint_name: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    conversations: Mapped[List["Conversation"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    research_jobs: Mapped[List["ResearchJob"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    projects: Mapped[List["BookProject"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    settings: Mapped[Optional["UserSetting"]] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


# 2. conversations
class Conversation(TimestampMixin, Base):
    __tablename__ = "conversations"
    __table_args__ = (Index("ix_conversations_user_updated", "user_id", "updated_at"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("book_projects.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(240), nullable=False, default="New Publishing Session")
    workflow_state: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    user: Mapped["User"] = relationship(back_populates="conversations")
    messages: Mapped[List["Message"]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


# 3. messages
class Message(TimestampMixin, Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_conversation_created", "conversation_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    attachments_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    workflow_cards_json: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")


# 4. research_jobs
class ResearchJob(TimestampMixin, Base):
    __tablename__ = "research_jobs"
    __table_args__ = (Index("ix_research_jobs_user_status", "user_id", "status"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    query: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(120), nullable=False)
    target_audience: Mapped[str] = mapped_column(String(120), nullable=False)
    marketplace: Mapped[str] = mapped_column(String(40), nullable=False, default="amazon.com")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    summary_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    user: Mapped["User"] = relationship(back_populates="research_jobs")
    sources: Mapped[List["ResearchSource"]] = relationship(back_populates="research_job", cascade="all, delete-orphan")
    niches: Mapped[List["Niche"]] = relationship(back_populates="research_job", cascade="all, delete-orphan")


# 5. research_sources
class ResearchSource(TimestampMixin, Base):
    __tablename__ = "research_sources"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    research_job_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("research_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connector_name: Mapped[str] = mapped_column(String(80), nullable=False)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    raw_metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    research_job: Mapped["ResearchJob"] = relationship(back_populates="sources")


# 6. niches
class Niche(TimestampMixin, Base):
    __tablename__ = "niches"
    __table_args__ = (
        Index("ix_niches_user_opportunity", "user_id", "opportunity_score"),
        Index("ix_niches_keyword", "keyword"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    research_job_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("research_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    niche_name: Mapped[str] = mapped_column(String(240), nullable=False)
    keyword: Mapped[str] = mapped_column(String(240), nullable=False)
    category: Mapped[str] = mapped_column(String(120), nullable=False)
    target_audience: Mapped[str] = mapped_column(String(120), nullable=False)
    marketplace: Mapped[str] = mapped_column(String(40), nullable=False, default="amazon.com")
    search_volume: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    competitor_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    demand_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    competition_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    keyword_opportunity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    market_gap_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    opportunity_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    evidence: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    source_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    research_job: Mapped["ResearchJob"] = relationship(back_populates="niches")
    competitors: Mapped[List["Competitor"]] = relationship(back_populates="niche", cascade="all, delete-orphan")
    keywords: Mapped[List["Keyword"]] = relationship(back_populates="niche", cascade="all, delete-orphan")


# 7. competitors
class Competitor(TimestampMixin, Base):
    __tablename__ = "competitors"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    niche_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("niches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    asin: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    category: Mapped[Optional[str]] = mapped_column(String(160), nullable=True)
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    rating: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    review_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bestseller_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    publication_info: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)

    niche: Mapped["Niche"] = relationship(back_populates="competitors")


# 8. keywords
class Keyword(TimestampMixin, Base):
    __tablename__ = "keywords"
    __table_args__ = (Index("ix_keywords_niche_phrase", "niche_id", "phrase"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    niche_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("niches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    phrase: Mapped[str] = mapped_column(String(200), nullable=False)
    search_volume: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    estimated_competition: Mapped[str] = mapped_column(String(32), nullable=False, default="Unknown")
    intent: Mapped[str] = mapped_column(String(64), nullable=False, default="Discovery")
    source_name: Mapped[str] = mapped_column(String(80), nullable=False)
    is_measured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    niche: Mapped["Niche"] = relationship(back_populates="keywords")


# 9. book_projects
class BookProject(TimestampMixin, Base):
    __tablename__ = "book_projects"
    __table_args__ = (
        CheckConstraint("page_count >= 24 AND page_count <= 828", name="ck_book_projects_kdp_pages"),
        Index("ix_book_projects_user_status", "user_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    book_type: Mapped[str] = mapped_column(String(80), nullable=False)
    target_audience: Mapped[str] = mapped_column(String(120), nullable=False)
    language: Mapped[str] = mapped_column(String(32), nullable=False, default="en")
    trim_width: Mapped[float] = mapped_column(Float, nullable=False, default=6.0)
    trim_height: Mapped[float] = mapped_column(Float, nullable=False, default=9.0)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    bleed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    paper_type: Mapped[str] = mapped_column(String(40), nullable=False, default="white")
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="drafting")
    seo_metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)

    user: Mapped["User"] = relationship(back_populates="projects")
    chapters: Mapped[List["BookChapter"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    pages: Mapped[List["BookPage"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    assets: Mapped[List["BookAsset"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    covers: Mapped[List["BookCover"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    approvals: Mapped[List["Approval"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    export_jobs: Mapped[List["ExportJob"]] = relationship(back_populates="project", cascade="all, delete-orphan")


# 10. book_chapters
class BookChapter(TimestampMixin, Base):
    __tablename__ = "book_chapters"
    __table_args__ = (UniqueConstraint("project_id", "chapter_number", name="uq_chapter_project_num"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("book_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chapter_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    outline_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="planned")

    project: Mapped["BookProject"] = relationship(back_populates="chapters")


# 11. book_assets (defined before book_pages for FK reference)
class BookAsset(TimestampMixin, Base):
    __tablename__ = "book_assets"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("book_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_type: Mapped[str] = mapped_column(String(48), nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(80), nullable=False)
    width_px: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height_px: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    project: Mapped["BookProject"] = relationship(back_populates="assets")


# 12. book_pages
class BookPage(TimestampMixin, Base):
    __tablename__ = "book_pages"
    __table_args__ = (
        UniqueConstraint("project_id", "page_number", name="uq_page_project_num"),
        Index("ix_book_pages_project_num", "project_id", "page_number"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("book_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    image_asset_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("book_assets.id", ondelete="SET NULL"), nullable=True
    )
    page_type: Mapped[str] = mapped_column(String(48), nullable=False, default="content")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")

    project: Mapped["BookProject"] = relationship(back_populates="pages")


# 13. book_covers
class BookCover(TimestampMixin, Base):
    __tablename__ = "book_covers"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("book_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_id: Mapped[str] = mapped_column(String(64), nullable=False, default="editorial_minimal")
    front_panel_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    spine_panel_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    back_panel_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    calculated_spine_in: Mapped[float] = mapped_column(Float, nullable=False)
    full_wrap_width_in: Mapped[float] = mapped_column(Float, nullable=False)
    full_wrap_height_in: Mapped[float] = mapped_column(Float, nullable=False)
    artwork_asset_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("book_assets.id", ondelete="SET NULL"), nullable=True
    )

    project: Mapped["BookProject"] = relationship(back_populates="covers")


# 14. approvals
class Approval(TimestampMixin, Base):
    __tablename__ = "approvals"
    __table_args__ = (Index("ix_approvals_project_status", "project_id", "status"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("book_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_type: Mapped[str] = mapped_column(String(64), nullable=False)
    proposed_data: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    feedback_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped["BookProject"] = relationship(back_populates="approvals")


# 15. export_jobs
class ExportJob(TimestampMixin, Base):
    __tablename__ = "export_jobs"
    __table_args__ = (Index("ix_export_jobs_project_status", "project_id", "status"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("book_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    artifact_type: Mapped[str] = mapped_column(String(48), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    validation_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    validation_report_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    project: Mapped["BookProject"] = relationship(back_populates="export_jobs")


# 16. ai_generations
class AIGeneration(TimestampMixin, Base):
    __tablename__ = "ai_generations"
    __table_args__ = (Index("ix_ai_generations_user_agent", "user_id", "agent_name"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("book_projects.id", ondelete="SET NULL"), nullable=True
    )
    agent_name: Mapped[str] = mapped_column(String(80), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    model_name: Mapped[str] = mapped_column(String(120), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="completed")
    output_summary_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)


# 17. user_settings
class UserSetting(TimestampMixin, Base):
    __tablename__ = "user_settings"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    theme: Mapped[str] = mapped_column(String(24), nullable=False, default="dark")
    default_marketplace: Mapped[str] = mapped_column(String(40), nullable=False, default="amazon.com")
    default_trim_size: Mapped[str] = mapped_column(String(24), nullable=False, default="6x9")
    default_paper_type: Mapped[str] = mapped_column(String(32), nullable=False, default="white")
    scoring_weights_json: Mapped[Dict[str, float]] = mapped_column(JSONB, default=dict, nullable=False)

    user: Mapped["User"] = relationship(back_populates="settings")


# 18. audit_logs
class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_user_created", "user_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[Optional[UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
