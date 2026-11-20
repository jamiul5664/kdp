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


class ApiProvider(Base):
    """Registry of built-in and dynamically added AI provider types."""

    __tablename__ = "api_providers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    provider_type: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(160))
    protocol: Mapped[str] = mapped_column(String(60), default="openai_compatible")
    default_base_url: Mapped[str] = mapped_column(Text, default="")
    supports_model_discovery: Mapped[bool] = mapped_column(Boolean, default=True)
    requires_api_key: Mapped[bool] = mapped_column(Boolean, default=True)
    default_capabilities: Mapped[list[str]] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ApiConfiguration(Base):
    """Unlimited per-user provider configurations (supports multiple configs per provider)."""

    __tablename__ = "api_configurations"
    __table_args__ = (
        Index("ix_api_configurations_user_provider", "user_id", "provider_type"),
        Index("ix_api_configurations_user_priority", "user_id", "priority"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("api_providers.id", ondelete="SET NULL"), nullable=True, index=True)
    provider_name: Mapped[str] = mapped_column(String(180))
    provider_type: Mapped[str] = mapped_column(String(80), index=True)
    base_url: Mapped[str] = mapped_column(Text)
    api_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    organization_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    custom_headers: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    default_model: Mapped[str] = mapped_column(String(180), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    folder: Mapped[str] = mapped_column(String(100), default="Default", index=True)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    priority: Mapped[int] = mapped_column(Integer, default=10)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    health_status: Mapped[str] = mapped_column(String(32), default="untested", index=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, default=0)
    cooldown_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ApiKeyRecord(Base):
    """Encrypted API secrets separated from configuration metadata for rotation and strict secrecy."""

    __tablename__ = "api_keys"
    __table_args__ = (
        Index("ix_api_keys_user_config", "user_id", "configuration_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    configuration_id: Mapped[str] = mapped_column(String(36), ForeignKey("api_configurations.id", ondelete="CASCADE"), index=True)
    encrypted_payload: Mapped[str] = mapped_column(Text)  # Authenticated ciphertext (AES-GCM JSON envelope)
    masked_key: Mapped[str] = mapped_column(String(64))
    key_fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    key_version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ApiModel(Base):
    """Discovered and manually entered models with explicit capability metadata."""

    __tablename__ = "api_models"
    __table_args__ = (
        Index("ix_api_models_config_model", "configuration_id", "model_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    configuration_id: Mapped[str] = mapped_column(String(36), ForeignKey("api_configurations.id", ondelete="CASCADE"), index=True)
    model_id: Mapped[str] = mapped_column(String(200), index=True)
    display_name: Mapped[str] = mapped_column(String(200))
    capabilities: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    context_window: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ApiUsageLog(Base):
    """Per-request usage & latency audit table; nullable tokens/cost when provider omits telemetry."""

    __tablename__ = "api_usage_logs"
    __table_args__ = (
        Index("ix_api_usage_user_created", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    configuration_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("api_configurations.id", ondelete="SET NULL"), nullable=True, index=True)
    task_key: Mapped[str] = mapped_column(String(80), index=True)
    model_id: Mapped[str] = mapped_column(String(200), default="")
    success: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    error_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    fallback_used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ApiHealthCheck(Base):
    """Detailed connection test and health monitoring history."""

    __tablename__ = "api_health_checks"
    __table_args__ = (
        Index("ix_api_health_config_checked", "configuration_id", "checked_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    configuration_id: Mapped[str] = mapped_column(String(36), ForeignKey("api_configurations.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(32))
    auth_status: Mapped[str] = mapped_column(String(40))
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    models_discovered: Mapped[int] = mapped_column(Integer, default=0)
    provider_response: Mapped[str] = mapped_column(Text, default="")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class ApiRoutingRule(Base):
    """User-configurable smart routing and health failover policies."""

    __tablename__ = "api_routing_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True)
    strategy: Mapped[str] = mapped_column(String(40), default="priority_then_latency")
    auto_disable_on_auth_error: Mapped[bool] = mapped_column(Boolean, default=True)
    max_consecutive_failures: Mapped[int] = mapped_column(Integer, default=3)
    cooldown_seconds: Mapped[int] = mapped_column(Integer, default=120)
    max_retries_per_request: Mapped[int] = mapped_column(Integer, default=2)
    forbid_quota_bypass_key_rotation: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ApiTaskAssignment(Base):
    """Per-user assignment of primary and fallback providers/models across all 9 KDP Studio AI tasks."""

    __tablename__ = "api_task_assignments"
    __table_args__ = (
        Index("ix_api_task_assignments_user_task", "user_id", "task_key", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    task_key: Mapped[str] = mapped_column(String(80), index=True)
    selection_mode: Mapped[str] = mapped_column(String(24), default="automatic")  # automatic | manual
    primary_configuration_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("api_configurations.id", ondelete="SET NULL"), nullable=True)
    primary_model_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    fallback_configuration_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("api_configurations.id", ondelete="SET NULL"), nullable=True)
    fallback_model_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
