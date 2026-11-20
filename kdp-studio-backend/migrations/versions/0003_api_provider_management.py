"""Create 8 flexible Multi-Provider API Management tables.

Revision ID: 0003_api_provider_management
Revises: 0002_advanced_pgvector
Create Date: 2026-11-20
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_api_provider_management"
down_revision = "0002_advanced_pgvector"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "api_providers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("provider_type", sa.String(80), nullable=False, unique=True),
        sa.Column("display_name", sa.String(160), nullable=False),
        sa.Column("protocol", sa.String(60), nullable=False),
        sa.Column("default_base_url", sa.Text(), nullable=False, server_default=""),
        sa.Column("supports_model_discovery", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("requires_api_key", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("default_capabilities", sa.JSON(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "api_configurations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider_id", sa.String(36), sa.ForeignKey("api_providers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("provider_name", sa.String(180), nullable=False),
        sa.Column("provider_type", sa.String(80), nullable=False),
        sa.Column("base_url", sa.Text(), nullable=False),
        sa.Column("api_version", sa.String(64), nullable=True),
        sa.Column("organization_id", sa.String(128), nullable=True),
        sa.Column("custom_headers", sa.JSON(), nullable=False),
        sa.Column("default_model", sa.String(180), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("folder", sa.String(100), nullable=False, server_default="Default"),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("health_status", sa.String(32), nullable=False, server_default="untested"),
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_latency_ms", sa.Integer(), nullable=True),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_api_configurations_user_provider", "api_configurations", ["user_id", "provider_type"])
    op.create_index("ix_api_configurations_user_priority", "api_configurations", ["user_id", "priority"])

    op.create_table(
        "api_keys",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("configuration_id", sa.String(36), sa.ForeignKey("api_configurations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("encrypted_payload", sa.Text(), nullable=False),
        sa.Column("masked_key", sa.String(64), nullable=False),
        sa.Column("key_fingerprint", sa.String(64), nullable=False),
        sa.Column("key_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_api_keys_user_config", "api_keys", ["user_id", "configuration_id"])

    op.create_table(
        "api_models",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("configuration_id", sa.String(36), sa.ForeignKey("api_configurations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_id", sa.String(200), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("capabilities", sa.JSON(), nullable=False),
        sa.Column("is_manual", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("context_window", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_api_models_config_model", "api_models", ["configuration_id", "model_id"])

    op.create_table(
        "api_usage_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("configuration_id", sa.String(36), sa.ForeignKey("api_configurations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("task_key", sa.String(80), nullable=False),
        sa.Column("model_id", sa.String(200), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("error_type", sa.String(64), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=True),
        sa.Column("fallback_used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_api_usage_user_created", "api_usage_logs", ["user_id", "created_at"])

    op.create_table(
        "api_health_checks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("configuration_id", sa.String(36), sa.ForeignKey("api_configurations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("auth_status", sa.String(40), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("models_discovered", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("provider_response", sa.Text(), nullable=False, server_default=""),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_api_health_config_checked", "api_health_checks", ["configuration_id", "checked_at"])

    op.create_table(
        "api_routing_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("strategy", sa.String(40), nullable=False, server_default="priority_then_latency"),
        sa.Column("auto_disable_on_auth_error", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("max_consecutive_failures", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("cooldown_seconds", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("max_retries_per_request", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("forbid_quota_bypass_key_rotation", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "api_task_assignments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_key", sa.String(80), nullable=False),
        sa.Column("selection_mode", sa.String(24), nullable=False, server_default="automatic"),
        sa.Column("primary_configuration_id", sa.String(36), sa.ForeignKey("api_configurations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("primary_model_id", sa.String(200), nullable=True),
        sa.Column("fallback_configuration_id", sa.String(36), sa.ForeignKey("api_configurations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("fallback_model_id", sa.String(200), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_api_task_assignments_user_task", "api_task_assignments", ["user_id", "task_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_api_task_assignments_user_task", table_name="api_task_assignments")
    op.drop_table("api_task_assignments")
    op.drop_table("api_routing_rules")
    op.drop_index("ix_api_health_config_checked", table_name="api_health_checks")
    op.drop_table("api_health_checks")
    op.drop_index("ix_api_usage_user_created", table_name="api_usage_logs")
    op.drop_table("api_usage_logs")
    op.drop_index("ix_api_models_config_model", table_name="api_models")
    op.drop_table("api_models")
    op.drop_index("ix_api_keys_user_config", table_name="api_keys")
    op.drop_table("api_keys")
    op.drop_index("ix_api_configurations_user_priority", table_name="api_configurations")
    op.drop_index("ix_api_configurations_user_provider", table_name="api_configurations")
    op.drop_table("api_configurations")
    op.drop_table("api_providers")
