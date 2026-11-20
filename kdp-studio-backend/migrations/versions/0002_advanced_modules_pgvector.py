"""Add advanced KDP Studio modules and PostgreSQL pgvector project memory.

Revision ID: 0002_advanced_pgvector
Revises: 0001_initial_schema
Create Date: 2026-11-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_advanced_pgvector"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    op.create_table(
        "book_style_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("art_style", sa.Text(), nullable=False, server_default=""),
        sa.Column("line_weight", sa.String(180), nullable=False, server_default=""),
        sa.Column("color_palette", sa.JSON(), nullable=False),
        sa.Column("character_descriptions", sa.JSON(), nullable=False),
        sa.Column("background_style_memory", sa.Text(), nullable=False, server_default=""),
        sa.Column("illustration_rules", sa.Text(), nullable=False, server_default=""),
        sa.Column("typography_rules", sa.Text(), nullable=False, server_default=""),
        sa.Column("page_layout_rules", sa.Text(), nullable=False, server_default=""),
        sa.Column("writing_tone", sa.String(255), nullable=False, server_default=""),
        sa.Column("target_audience", sa.String(255), nullable=False, server_default=""),
        sa.Column("approved_page_ids", sa.JSON(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "project_memories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("memory_type", sa.String(80), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding_vector", sa.JSON(), nullable=False),
        sa.Column("approved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("approval_locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("audit_trail", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_project_memories_user_project", "project_memories", ["user_id", "project_id"])
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TABLE project_memories ADD COLUMN IF NOT EXISTS embedding vector(1536);")
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_project_memories_embedding_ivfflat "
            "ON project_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 64);"
        )

    op.create_table(
        "asset_provenance",
        sa.Column("asset_id", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("creation_method", sa.String(80), nullable=False),
        sa.Column("provider", sa.String(140), nullable=False),
        sa.Column("original_prompt", sa.Text(), nullable=False, server_default=""),
        sa.Column("source_reference", sa.Text(), nullable=False, server_default=""),
        sa.Column("license_information", sa.Text(), nullable=False, server_default=""),
        sa.Column("creation_date", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "workflow_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False, unique=True),
        sa.Column("source", sa.String(40), nullable=False, server_default="chat"),
        sa.Column("status", sa.String(40), nullable=False, server_default="waiting_approval"),
        sa.Column("checkpoint_step_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("steps_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "scheduled_research_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("query", sa.String(255), nullable=False),
        sa.Column("marketplace", sa.String(40), nullable=False, server_default="amazon.com"),
        sa.Column("cadence", sa.String(32), nullable=False, server_default="Weekly"),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="UTC"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("user_consent_granted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("scheduled_research_rules")
    op.drop_table("workflow_runs")
    op.drop_table("asset_provenance")
    op.drop_index("ix_project_memories_user_project", table_name="project_memories")
    op.drop_table("project_memories")
    op.drop_table("book_style_profiles")
