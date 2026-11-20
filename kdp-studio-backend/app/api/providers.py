from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.dependencies import get_current_user_id
from app.services.provider_management import (
    TASK_REQUIRED_CAPABILITY,
    HealthPolicy,
    ModelSpec,
    MultiProviderManager,
    ProviderRegistry,
    validate_provider_url,
)

router = APIRouter()
provider_manager = MultiProviderManager()


class ModelSpecPayload(BaseModel):
    model_id: str = Field(..., min_length=1, max_length=180)
    capabilities: list[str] = Field(default_factory=lambda: ["chat"])
    is_manual: bool = True


class ProviderConfigCreatePayload(BaseModel):
    provider_name: str = Field(..., min_length=1, max_length=160)
    provider_type: str = Field(..., min_length=1, max_length=64)
    base_url: str = Field(..., min_length=8, max_length=512)
    api_key: str | None = None
    default_model: str | None = None
    models: list[ModelSpecPayload] = Field(default_factory=list)
    priority: int = Field(default=10, ge=1, le=1000)
    folder: str = Field(default="Default", max_length=80)
    tags: list[str] = Field(default_factory=list)
    enabled: bool = True
    is_default: bool = False


class ProviderConfigUpdatePayload(BaseModel):
    provider_name: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    default_model: str | None = None
    priority: int | None = Field(default=None, ge=1, le=1000)
    folder: str | None = None
    tags: list[str] | None = None
    enabled: bool | None = None
    is_default: bool | None = None


class TaskAssignmentPayload(BaseModel):
    mode: str = Field(default="manual", pattern="^(automatic|manual)$")
    primary_config_id: str
    primary_model_id: str | None = None
    fallback_config_id: str | None = None
    fallback_model_id: str | None = None


class HealthPolicyPayload(BaseModel):
    auto_disable_on_auth_error: bool = True
    max_consecutive_failures: int = Field(default=3, ge=1, le=10)
    cooldown_seconds: int = Field(default=120, ge=15, le=3600)
    max_retries_per_request: int = Field(default=2, ge=0, le=3)


class SecretFreeImportPayload(BaseModel):
    configs: list[dict[str, Any]] = Field(default_factory=list)


@router.get("/meta")
async def get_provider_meta() -> dict[str, Any]:
    return {
        "templates": [
            {"provider_type": k, **v}
            for k, v in ProviderRegistry.BUILT_IN_TEMPLATES.items()
        ],
        "tasks": [
            {"task_key": k, "required_capability": cap}
            for k, cap in TASK_REQUIRED_CAPABILITY.items()
        ],
    }


@router.get("/state")
async def get_provider_state(
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    configs = [
        provider_manager.get_public_config(cfg.id, uid)
        for cfg in provider_manager._configs.values()
        if cfg.user_id == uid
    ]
    configs.sort(key=lambda c: c["priority"])
    assignments = [
        val for (owner_id, _), val in provider_manager._task_assignments.items() if owner_id == uid
    ]
    policy = provider_manager._health_policies.get(uid, HealthPolicy())
    usage = [u for u in provider_manager.usage_logs if u["user_id"] == uid]
    health = [h for h in provider_manager.health_history if h["user_id"] == uid]
    notifications = [n for n in provider_manager.notifications if n["user_id"] == uid]

    return {
        "configs": configs,
        "task_assignments": assignments,
        "health_policy": {
            "auto_disable_on_auth_error": policy.auto_disable_on_auth_error,
            "max_consecutive_failures": policy.max_consecutive_failures,
            "cooldown_seconds": policy.cooldown_seconds,
            "max_retries_per_request": policy.max_retries_per_request,
            "forbid_quota_bypass_key_rotation": True,
        },
        "usage_logs": usage[-60:],
        "health_history": health[-60:],
        "notifications": notifications[-30:],
    }


@router.post("/configs", status_code=status.HTTP_201_CREATED)
async def create_provider_config(
    payload: ProviderConfigCreatePayload,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    models = [
        ModelSpec(model_id=m.model_id, capabilities=m.capabilities, is_manual=m.is_manual)
        for m in payload.models
    ]
    if payload.default_model and not any(m.model_id == payload.default_model for m in models):
        models.insert(0, ModelSpec(model_id=payload.default_model, capabilities=["chat", "writing"], is_manual=True))
    try:
        rec = provider_manager.add_configuration(
            user_id=uid,
            provider_name=payload.provider_name,
            provider_type=payload.provider_type,
            base_url=payload.base_url,
            api_key=payload.api_key,
            models=models,
            priority=payload.priority,
            folder=payload.folder,
            tags=payload.tags,
            enabled=payload.enabled,
            is_default=payload.is_default,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"config": provider_manager.get_public_config(rec.id, uid)}


@router.put("/configs/{config_id}")
async def update_provider_config(
    config_id: str,
    payload: ProviderConfigUpdatePayload,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    rec = provider_manager._configs.get(config_id)
    if not rec or rec.user_id != uid:
        raise HTTPException(status_code=404, detail="Provider configuration not found.")

    if payload.base_url:
        try:
            rec.base_url = validate_provider_url(payload.base_url, rec.provider_type)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    if payload.provider_name is not None:
        rec.provider_name = payload.provider_name.strip()
    if payload.default_model is not None:
        rec.default_model = payload.default_model.strip()
    if payload.priority is not None:
        rec.priority = payload.priority
    if payload.folder is not None:
        rec.folder = payload.folder.strip()
    if payload.tags is not None:
        rec.tags = payload.tags
    if payload.enabled is not None:
        rec.enabled = payload.enabled
    if payload.is_default is not None:
        if payload.is_default:
            for other in provider_manager._configs.values():
                if other.user_id == uid:
                    other.is_default = False
        rec.is_default = payload.is_default

    if payload.api_key:
        rec.encrypted_key = provider_manager.secrets.encrypt(payload.api_key)
        rec.masked_key = provider_manager.secrets.mask(payload.api_key)
        rec.key_fingerprint = provider_manager.secrets.fingerprint(payload.api_key)
        rec.health_status = "untested"
        rec.consecutive_failures = 0
        rec.cooldown_until = None

    return {"config": provider_manager.get_public_config(rec.id, uid)}


@router.delete("/configs/{config_id}")
async def delete_provider_config(
    config_id: str,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    rec = provider_manager._configs.get(config_id)
    if not rec or rec.user_id != uid:
        raise HTTPException(status_code=404, detail="Provider configuration not found.")
    del provider_manager._configs[config_id]
    return {"deleted": True, "id": config_id}


@router.post("/configs/{config_id}/models", status_code=status.HTTP_201_CREATED)
async def add_manual_model(
    config_id: str,
    payload: ModelSpecPayload,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    rec = provider_manager._configs.get(config_id)
    if not rec or rec.user_id != uid:
        raise HTTPException(status_code=404, detail="Provider configuration not found.")
    rec.models.append(
        ModelSpec(
            model_id=payload.model_id.strip(),
            capabilities=payload.capabilities or ["chat"],
            is_manual=True,
        )
    )
    if not rec.default_model:
        rec.default_model = payload.model_id.strip()
    return {"config": provider_manager.get_public_config(rec.id, uid)}


@router.post("/configs/{config_id}/recover")
async def recover_provider_config(
    config_id: str,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    try:
        rec = provider_manager.recover_configuration(config_id, uid)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"config": provider_manager.get_public_config(rec.id, uid)}


@router.put("/tasks/{task_key}")
async def assign_task_provider(
    task_key: str,
    payload: TaskAssignmentPayload,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    try:
        assignment = provider_manager.assign_task(
            user_id=uid,
            task_key=task_key,
            primary_config_id=payload.primary_config_id,
            primary_model_id=payload.primary_model_id,
            fallback_config_id=payload.fallback_config_id,
            fallback_model_id=payload.fallback_model_id,
            mode=payload.mode,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"assignment": assignment}


@router.post("/tasks/{task_key}/resolve")
async def resolve_task_route(
    task_key: str,
    override_config_id: str | None = None,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    if task_key not in TASK_REQUIRED_CAPABILITY:
        raise HTTPException(status_code=400, detail=f"Unsupported task_key: {task_key}")
    candidates = provider_manager.resolve_route_candidates(
        user_id=uid,
        task_key=task_key,
        override_config_id=override_config_id,
    )
    if not candidates:
        raise HTTPException(
            status_code=422,
            detail=f"No compatible enabled provider available for '{task_key}' (requires '{TASK_REQUIRED_CAPABILITY[task_key]}').",
        )
    return {
        "task_key": task_key,
        "required_capability": TASK_REQUIRED_CAPABILITY[task_key],
        "candidates": [
            {
                "config_id": rec.id,
                "provider_name": rec.provider_name,
                "provider_type": rec.provider_type,
                "model_id": model_id,
                "priority": rec.priority,
            }
            for rec, model_id in candidates
        ],
    }


@router.put("/health-rules")
async def update_health_policy(
    payload: HealthPolicyPayload,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    policy = HealthPolicy(
        auto_disable_on_auth_error=payload.auto_disable_on_auth_error,
        max_consecutive_failures=payload.max_consecutive_failures,
        cooldown_seconds=payload.cooldown_seconds,
        max_retries_per_request=payload.max_retries_per_request,
        forbid_quota_bypass_key_rotation=True,
    )
    provider_manager._health_policies[uid] = policy
    return {"health_policy": payload.model_dump() | {"forbid_quota_bypass_key_rotation": True}}


@router.get("/export-config")
async def export_secret_free_config(
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    return provider_manager.export_secret_free_config(str(user_id))


@router.post("/import-config")
async def import_secret_free_config(
    payload: SecretFreeImportPayload,
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    uid = str(user_id)
    imported: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    for item in payload.configs:
        try:
            models = [
                ModelSpec(
                    model_id=str(m.get("model_id", "")),
                    capabilities=list(m.get("capabilities", ["chat"])),
                    is_manual=True,
                )
                for m in item.get("models", [])
                if m.get("model_id")
            ]
            rec = provider_manager.add_configuration(
                user_id=uid,
                provider_name=str(item.get("provider_name") or "Imported Provider"),
                provider_type=str(item.get("provider_type") or "openai_compatible"),
                base_url=str(item.get("base_url") or ""),
                api_key=None,
                models=models,
                priority=int(item.get("priority") or 20),
                folder=str(item.get("folder") or "Imported"),
                tags=list(item.get("tags") or ["imported"]),
                enabled=False,
            )
            imported.append(provider_manager.get_public_config(rec.id, uid))
        except ValueError as exc:
            skipped.append({"provider_name": str(item.get("provider_name") or "Unnamed"), "reason": str(exc)})
    return {"imported_count": len(imported), "skipped": skipped, "imported": imported}
