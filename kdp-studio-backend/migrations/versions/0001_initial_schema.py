"""Initial 18-table KDP Studio AI PostgreSQL schema.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Uses SQLAlchemy metadata creation via Alembic connection for full 18-table parity
    from app.core.database import Base
    import app.models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    tables = [
        "audit_logs",
        "user_settings",
        "ai_generations",
        "export_jobs",
        "approvals",
        "book_covers",
        "book_pages",
        "book_assets",
        "book_chapters",
        "book_projects",
        "keywords",
        "competitors",
        "niches",
        "research_sources",
        "research_jobs",
        "messages",
        "conversations",
        "users",
    ]
    for table_name in tables:
        op.drop_table(table_name)
