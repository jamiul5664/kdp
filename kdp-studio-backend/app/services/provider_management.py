from __future__ import annotations

import base64
import hashlib
import hmac
import ipaddress
import json
import os
import secrets
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable
from urllib.parse import urlparse

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM  # type: ignore

    HAS_AESGCM = True
except Exception:
    HAS_AESGCM = False


# ---------------------------------------------------------------------------
# 1. Authenticated Secret Manager (AES-256-GCM when cryptography is installed,
#    authenticated Encrypt-then-MAC SHA-256 fallback in minimal stdlib envs)
# ---------------------------------------------------------------------------
class SecretManager:
    def __init__(self, master_secret: str | None = None) -> None:
        raw = master_secret or os.getenv("API_SECRET_MASTER_KEY") or os.getenv("JWT_SECRET_KEY") or "kdp-dev-master-key"
        self._enc_key = hashlib.pbkdf2_hmac("sha256", raw.encode("utf-8"), b"kdp-studio-enc-salt-v1", 120_000, dklen=32)
        self._mac_key = hashlib.pbkdf2_hmac("sha256", raw.encode("utf-8"), b"kdp-studio-mac-salt-v1", 120_000, dklen=32)

    def encrypt(self, plaintext: str, key_version: int = 1) -> str:
        data = plaintext.encode("utf-8")
        nonce = secrets.token_bytes(12)
        if HAS_AESGCM:
            ct = AESGCM(self._enc_key).encrypt(nonce, data, f"v{key_version}".encode("utf-8"))
            envelope = {
                "alg": "AES-256-GCM",
                "v": key_version,
                "n": base64.b64encode(nonce).decode("ascii"),
                "c": base64.b64encode(ct).decode("ascii"),
            }
            return json.dumps(envelope)

        # Stdlib authenticated stream cipher (Encrypt-then-MAC HMAC-SHA256)
        stream = self._keystream(nonce, len(data))
        ct = bytes(a ^ b for a, b in zip(data, stream))
        tag = hmac.new(self._mac_key, nonce + ct + f"v{key_version}".encode("utf-8"), hashlib.sha256).digest()
        envelope = {
            "alg": "ETM-SHA256-CTR",
            "v": key_version,
            "n": base64.b64encode(nonce).decode("ascii"),
            "c": base64.b64encode(ct).decode("ascii"),
            "t": base64.b64encode(tag).decode("ascii"),
        }
        return json.dumps(envelope)

    def decrypt(self, encoded_envelope: str) -> str:
        env = json.loads(encoded_envelope)
        nonce = base64.b64decode(env["n"])
        ct = base64.b64decode(env["c"])
        version = int(env.get("v", 1))
        alg = env.get("alg")
        if alg == "AES-256-GCM":
            if not HAS_AESGCM:
                raise RuntimeError("cryptography library required to decrypt AES-256-GCM payload.")
            pt = AESGCM(self._enc_key).decrypt(nonce, ct, f"v{version}".encode("utf-8"))
            return pt.decode("utf-8")

        expected_tag = hmac.new(self._mac_key, nonce + ct + f"v{version}".encode("utf-8"), hashlib.sha256).digest()
        actual_tag = base64.b64decode(env["t"])
        if not hmac.compare_digest(expected_tag, actual_tag):
            raise ValueError("Authenticated decryption failed: ciphertext tampered or wrong key.")
        stream = self._keystream(nonce, len(ct))
        pt = bytes(a ^ b for a, b in zip(ct, stream))
        return pt.decode("utf-8")

    def _keystream(self, nonce: bytes, length: int) -> bytes:
        out = bytearray()
        counter = 0
        while len(out) < length:
            block = hmac.new(self._enc_key, nonce + counter.to_bytes(4, "big"), hashlib.sha256).digest()
            out.extend(block)
            counter += 1
        return bytes(out[:length])

    @staticmethod
    def mask(plaintext: str) -> str:
        s = plaintext.strip()
        if not s:
            return "Not Configured"
        if len(s) <= 8:
            return f"{s[:2]}••••••"
        return f"{s[:4]}••••••••{s[-4:]}"

    @staticmethod
    def fingerprint(plaintext: str) -> str:
        return hashlib.sha256(plaintext.strip().encode("utf-8")).hexdigest()[:12]


# ---------------------------------------------------------------------------
# 2. SSRF & Custom Base URL Validation
# ---------------------------------------------------------------------------
def validate_provider_url(url: str, provider_type: str, allow_local_ollama: bool = True) -> str:
    parsed = urlparse(url.strip())
    if not parsed.scheme or not parsed.hostname:
        raise ValueError("Invalid API base URL.")
    if parsed.username or parsed.password:
        raise ValueError("Credentials inside URL are prohibited.")

    local_ollama_ok = provider_type == "ollama" and allow_local_ollama
    if parsed.scheme != "https" and not (local_ollama_ok and parsed.scheme == "http"):
        raise ValueError("Only HTTPS provider URLs are allowed (HTTP is restricted to explicitly enabled local Ollama).")

    host = parsed.hostname.lower().strip("[]")
    blocked_names = {"localhost", "0.0.0.0", "::1", "metadata.google.internal", "169.254.169.254"}
    if host in blocked_names or host.endswith(".local") or host.endswith(".internal"):
        if not (local_ollama_ok and host in {"localhost", "127.0.0.1"}):
            raise ValueError(f"SSRF protection blocked private or metadata host '{host}'.")

    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            if not (local_ollama_ok and str(ip) == "127.0.0.1"):
                raise ValueError(f"SSRF protection blocked private/loopback IP '{host}'.")
    except ValueError as exc:
        if "SSRF" in str(exc):
            raise

    return url.strip().rstrip("/")


# ---------------------------------------------------------------------------
# 3. Common Provider Adapter Interface & Built-in Registry (15 Types)
# ---------------------------------------------------------------------------
TASK_REQUIRED_CAPABILITY: dict[str, str] = {
    "market_research": "research",
    "competitor_analysis": "research",
    "book_writing": "writing",
    "book_planning": "reasoning",
    "coloring_prompt_generation": "writing",
    "image_generation": "image_generation",
    "seo_research": "research",
    "pdf_quality_analysis": "vision",
    "chat_assistant": "chat",
}


class ProviderAdapter(ABC):
    protocol: str

    @abstractmethod
    def build_discovery_request(self, base_url: str, api_key: str, headers: dict[str, str], org_id: str | None) -> tuple[str, dict[str, str]]:
        ...

    @abstractmethod
    def parse_models_response(self, payload: dict[str, Any]) -> list[str]:
        ...


class GoogleGeminiAdapter(ProviderAdapter):
    protocol = "gemini"

    def build_discovery_request(self, base_url: str, api_key: str, headers: dict[str, str], org_id: str | None) -> tuple[str, dict[str, str]]:
        merged = {"Accept": "application/json", **headers}
        if api_key:
            merged["x-goog-api-key"] = api_key
        return f"{base_url}/models?pageSize=25", merged

    def parse_models_response(self, payload: dict[str, Any]) -> list[str]:
        return [str(m.get("name", "")).replace("models/", "") for m in payload.get("models", []) if m.get("name")]


class OpenAICompatibleAdapter(ProviderAdapter):
    protocol = "openai_compatible"

    def build_discovery_request(self, base_url: str, api_key: str, headers: dict[str, str], org_id: str | None) -> tuple[str, dict[str, str]]:
        merged = {"Accept": "application/json", **headers}
        if api_key:
            merged["Authorization"] = f"Bearer {api_key}"
        if org_id:
            merged["OpenAI-Organization"] = org_id
        return f"{base_url}/models", merged

    def parse_models_response(self, payload: dict[str, Any]) -> list[str]:
        return [str(m.get("id")) for m in payload.get("data", []) if m.get("id")]


class OllamaAdapter(ProviderAdapter):
    protocol = "ollama"

    def build_discovery_request(self, base_url: str, api_key: str, headers: dict[str, str], org_id: str | None) -> tuple[str, dict[str, str]]:
        merged = {"Accept": "application/json", **headers}
        if api_key:
            merged["Authorization"] = f"Bearer {api_key}"
        return f"{base_url}/api/tags", merged

    def parse_models_response(self, payload: dict[str, Any]) -> list[str]:
        return [str(m.get("name")) for m in payload.get("models", []) if m.get("name")]


class CustomHttpAdapter(ProviderAdapter):
    protocol = "custom_http"

    def build_discovery_request(self, base_url: str, api_key: str, headers: dict[str, str], org_id: str | None) -> tuple[str, dict[str, str]]:
        merged = {"Accept": "application/json", **headers}
        if api_key:
            merged["Authorization"] = f"Bearer {api_key}"
        return f"{base_url}/models", merged

    def parse_models_response(self, payload: dict[str, Any]) -> list[str]:
        items = payload.get("data") or payload.get("models") or []
        return [str(m.get("id") or m.get("name")) for m in items if isinstance(m, dict) and (m.get("id") or m.get("name"))]


class ProviderRegistry:
    """Extensible registry of built-in and dynamically registered adapters."""

    BUILT_IN_TEMPLATES: dict[str, dict[str, Any]] = {
        "google_gemini": {"display_name": "Google Gemini", "protocol": "gemini", "default_base_url": "https://generativelanguage.googleapis.com/v1beta"},
        "openrouter": {"display_name": "OpenRouter", "protocol": "openai_compatible", "default_base_url": "https://openrouter.ai/api/v1"},
        "omniroute": {"display_name": "OmniRoute", "protocol": "openai_compatible", "default_base_url": "https://api.omniroute.ai/v1"},
        "openai": {"display_name": "OpenAI", "protocol": "openai_compatible", "default_base_url": "https://api.openai.com/v1"},
        "groq": {"display_name": "Groq", "protocol": "openai_compatible", "default_base_url": "https://api.groq.com/openai/v1"},
        "cerebras": {"display_name": "Cerebras", "protocol": "openai_compatible", "default_base_url": "https://api.cerebras.ai/v1"},
        "huggingface": {"display_name": "Hugging Face", "protocol": "openai_compatible", "default_base_url": "https://router.huggingface.co/v1"},
        "deepseek": {"display_name": "DeepSeek", "protocol": "openai_compatible", "default_base_url": "https://api.deepseek.com/v1"},
        "qwen": {"display_name": "Qwen", "protocol": "openai_compatible", "default_base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"},
        "mistral": {"display_name": "Mistral", "protocol": "openai_compatible", "default_base_url": "https://api.mistral.ai/v1"},
        "together_ai": {"display_name": "Together AI", "protocol": "openai_compatible", "default_base_url": "https://api.together.xyz/v1"},
        "fireworks_ai": {"display_name": "Fireworks AI", "protocol": "openai_compatible", "default_base_url": "https://api.fireworks.ai/inference/v1"},
        "ollama": {"display_name": "Ollama", "protocol": "ollama", "default_base_url": "http://localhost:11434"},
        "openai_compatible": {"display_name": "OpenAI-Compatible API", "protocol": "openai_compatible", "default_base_url": "https://api.example.com/v1"},
        "custom_http": {"display_name": "Custom HTTP API Adapter", "protocol": "custom_http", "default_base_url": "https://api.custom.example/v1"},
    }

    def __init__(self) -> None:
        self._adapters: dict[str, ProviderAdapter] = {
            "gemini": GoogleGeminiAdapter(),
            "openai_compatible": OpenAICompatibleAdapter(),
            "ollama": OllamaAdapter(),
            "custom_http": CustomHttpAdapter(),
        }

    def register_adapter(self, protocol: str, adapter: ProviderAdapter) -> None:
        self._adapters[protocol] = adapter

    def get_adapter(self, provider_type: str) -> ProviderAdapter:
        tpl = self.BUILT_IN_TEMPLATES.get(provider_type, {"protocol": "openai_compatible"})
        return self._adapters.get(tpl["protocol"], self._adapters["openai_compatible"])


# ---------------------------------------------------------------------------
# 4. Configuration, Health Monitoring, Smart Routing & Policy-Compliant Failover
# ---------------------------------------------------------------------------
@dataclass
class ModelSpec:
    model_id: str
    capabilities: list[str]
    is_manual: bool = False


@dataclass
class ProviderConfigRecord:
    id: str
    user_id: str
    provider_name: str
    provider_type: str
    base_url: str
    encrypted_key: str | None
    masked_key: str
    key_fingerprint: str
    default_model: str
    models: list[ModelSpec] = field(default_factory=list)
    priority: int = 10
    enabled: bool = True
    is_default: bool = False
    folder: str = "Default"
    tags: list[str] = field(default_factory=list)
    health_status: str = "untested"
    consecutive_failures: int = 0
    cooldown_until: datetime | None = None
    last_latency_ms: int | None = None


@dataclass
class HealthPolicy:
    auto_disable_on_auth_error: bool = True
    max_consecutive_failures: int = 3
    cooldown_seconds: int = 120
    max_retries_per_request: int = 2
    forbid_quota_bypass_key_rotation: bool = True


def classify_error(status_code: int | None, message: str) -> tuple[str, bool, bool]:
    """Returns (error_kind, retryable, permanent)."""
    low = message.lower()
    if status_code in (401, 403) or "invalid api key" in low or "unauthorized" in low:
        return ("auth_error", False, True)
    if status_code == 429 or "rate limit" in low or "quota" in low:
        return ("quota_or_rate_limit", False, False)
    if (status_code and status_code >= 500) or "unavailable" in low or "overloaded" in low:
        return ("temporary_server_error", True, False)
    if "timeout" in low or "connection" in low:
        return ("network_timeout", True, False)
    return ("bad_request", False, True)


class MultiProviderManager:
    """Unified service implementing configuration storage, task assignment, smart routing, health monitoring & failover."""

    def __init__(self, secret_manager: SecretManager | None = None) -> None:
        self.secrets = secret_manager or SecretManager()
        self.registry = ProviderRegistry()
        self._configs: dict[str, ProviderConfigRecord] = {}
        self._task_assignments: dict[tuple[str, str], dict[str, Any]] = {}
        self._health_policies: dict[str, HealthPolicy] = {}
        self.usage_logs: list[dict[str, Any]] = []
        self.health_history: list[dict[str, Any]] = []
        self.notifications: list[dict[str, Any]] = []

    def add_configuration(
        self,
        *,
        user_id: str,
        provider_name: str,
        provider_type: str,
        base_url: str,
        api_key: str | None,
        models: list[ModelSpec],
        priority: int = 10,
        folder: str = "Default",
        tags: list[str] | None = None,
        enabled: bool = True,
        is_default: bool = False,
    ) -> ProviderConfigRecord:
        clean_url = validate_provider_url(base_url, provider_type)
        encrypted = self.secrets.encrypt(api_key) if api_key else None
        rec = ProviderConfigRecord(
            id=str(uuid.uuid4()),
            user_id=user_id,
            provider_name=provider_name.strip(),
            provider_type=provider_type,
            base_url=clean_url,
            encrypted_key=encrypted,
            masked_key=self.secrets.mask(api_key or ""),
            key_fingerprint=self.secrets.fingerprint(api_key or "") if api_key else "none",
            default_model=models[0].model_id if models else "",
            models=models,
            priority=max(1, priority),
            enabled=enabled,
            is_default=is_default,
            folder=folder,
            tags=tags or [],
        )
        self._configs[rec.id] = rec
        return rec

    def get_public_config(self, config_id: str, user_id: str) -> dict[str, Any]:
        rec = self._configs.get(config_id)
        if not rec or rec.user_id != user_id:
            raise KeyError("Configuration not found for user.")
        return {
            "id": rec.id,
            "provider_name": rec.provider_name,
            "provider_type": rec.provider_type,
            "base_url": rec.base_url,
            "masked_key": rec.masked_key,
            "key_fingerprint": rec.key_fingerprint,
            "default_model": rec.default_model,
            "priority": rec.priority,
            "enabled": rec.enabled,
            "health_status": rec.health_status,
            "models": [{"model_id": m.model_id, "capabilities": m.capabilities} for m in rec.models],
        }

    def assign_task(
        self,
        *,
        user_id: str,
        task_key: str,
        primary_config_id: str,
        primary_model_id: str | None = None,
        fallback_config_id: str | None = None,
        fallback_model_id: str | None = None,
        mode: str = "manual",
    ) -> dict[str, Any]:
        if task_key not in TASK_REQUIRED_CAPABILITY:
            raise ValueError(f"Unknown task_key: {task_key}")
        required_cap = TASK_REQUIRED_CAPABILITY[task_key]

        primary = self._configs.get(primary_config_id)
        if not primary or primary.user_id != user_id:
            raise KeyError("Primary configuration not found for user.")
        self._validate_capability(primary, primary_model_id or primary.default_model, required_cap, task_key)

        if fallback_config_id:
            fb = self._configs.get(fallback_config_id)
            if not fb or fb.user_id != user_id:
                raise KeyError("Fallback configuration not found for user.")
            self._validate_capability(fb, fallback_model_id or fb.default_model, required_cap, task_key)

        assignment = {
            "task_key": task_key,
            "mode": mode,
            "primary_config_id": primary_config_id,
            "primary_model_id": primary_model_id or primary.default_model,
            "fallback_config_id": fallback_config_id,
            "fallback_model_id": fallback_model_id,
        }
        self._task_assignments[(user_id, task_key)] = assignment
        return assignment

    @staticmethod
    def _validate_capability(rec: ProviderConfigRecord, model_id: str, required_cap: str, task_key: str) -> None:
        matched = next((m for m in rec.models if m.model_id == model_id), rec.models[0] if rec.models else None)
        caps = matched.capabilities if matched else []
        if required_cap == "image_generation" and "image_generation" not in caps:
            raise ValueError(f"Blocked: cannot send image_generation task '{task_key}' to text-only model '{model_id}'.")
        if required_cap == "vision" and "vision" not in caps:
            raise ValueError(f"Blocked: cannot send vision task '{task_key}' to non-vision model '{model_id}'.")
        if required_cap != "chat" and required_cap not in caps:
            raise ValueError(f"Model '{model_id}' lacks required capability '{required_cap}' for '{task_key}'.")

    def resolve_route_candidates(
        self,
        *,
        user_id: str,
        task_key: str,
        override_config_id: str | None = None,
    ) -> list[tuple[ProviderConfigRecord, str]]:
        required_cap = TASK_REQUIRED_CAPABILITY.get(task_key, "chat")
        now = datetime.now(timezone.utc)
        eligible: list[tuple[ProviderConfigRecord, str]] = []

        for rec in self._configs.values():
            if rec.user_id != user_id or not rec.enabled:
                continue
            if rec.cooldown_until and rec.cooldown_until > now:
                continue
            model = next((m for m in rec.models if required_cap in m.capabilities), None)
            if model:
                eligible.append((rec, model.model_id))

        eligible.sort(key=lambda pair: (pair[0].priority, pair[0].last_latency_ms or 500))
        ordered: list[tuple[ProviderConfigRecord, str]] = []
        seen: set[str] = set()

        def push(cfg_id: str | None, preferred_model: str | None = None) -> None:
            if not cfg_id or cfg_id in seen:
                return
            for rec, default_m in eligible:
                if rec.id == cfg_id:
                    seen.add(cfg_id)
                    m_id = preferred_model if preferred_model and any(m.model_id == preferred_model and required_cap in m.capabilities for m in rec.models) else default_m
                    ordered.append((rec, m_id))
                    break

        if override_config_id:
            push(override_config_id)
        assignment = self._task_assignments.get((user_id, task_key))
        if assignment:
            push(assignment.get("primary_config_id"), assignment.get("primary_model_id"))
            push(assignment.get("fallback_config_id"), assignment.get("fallback_model_id"))
            if assignment.get("mode") == "manual":
                return ordered

        for rec, m_id in eligible:
            push(rec.id, m_id)
        return ordered

    def execute_with_failover(
        self,
        *,
        user_id: str,
        task_key: str,
        executor: Callable[[ProviderConfigRecord, str], dict[str, Any]],
        override_config_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Executes a task with strict policy-compliant failover:
        - Never retries permanent authentication errors.
        - Never rotates to another key under the SAME provider_type on quota/rate-limit errors.
        - Prevents infinite retry loops via visited set + max_retries_per_request.
        """
        policy = self._health_policies.get(user_id, HealthPolicy())
        candidates = self.resolve_route_candidates(
            user_id=user_id,
            task_key=task_key,
            override_config_id=override_config_id,
        )
        if not candidates:
            raise RuntimeError(f"No compatible enabled API provider available for task '{task_key}'.")

        queue = list(candidates)
        visited: set[str] = set()
        attempts: list[dict[str, Any]] = []

        while queue:
            rec, model_id = queue.pop(0)
            if rec.id in visited:
                continue
            visited.add(rec.id)

            max_tries = 1
            attempt_idx = 0
            while attempt_idx < max_tries:
                attempt_idx += 1
                try:
                    result = executor(rec, model_id)
                    rec.health_status = "healthy"
                    rec.consecutive_failures = 0
                    rec.cooldown_until = None
                    self.usage_logs.append(
                        {
                            "user_id": user_id,
                            "config_id": rec.id,
                            "provider_type": rec.provider_type,
                            "task_key": task_key,
                            "model_id": model_id,
                            "success": True,
                            "prompt_tokens": result.get("prompt_tokens"),
                            "completion_tokens": result.get("completion_tokens"),
                            "estimated_cost_usd": result.get("estimated_cost_usd"),
                            "fallback_used": len(attempts) > 0,
                        }
                    )
                    return {
                        "used_config_id": rec.id,
                        "used_provider_name": rec.provider_name,
                        "used_provider_type": rec.provider_type,
                        "used_model_id": model_id,
                        "fallback_used": len(attempts) > 0,
                        "result": result,
                        "attempts": attempts,
                    }
                except Exception as exc:
                    status_code = getattr(exc, "status_code", None)
                    kind, retryable, permanent = classify_error(status_code, str(exc))
                    attempts.append(
                        {
                            "config_id": rec.id,
                            "provider_type": rec.provider_type,
                            "error_kind": kind,
                            "message": str(exc),
                        }
                    )
                    if retryable and attempt_idx == 1:
                        max_tries = 1 + policy.max_retries_per_request
                    if attempt_idx < max_tries and retryable:
                        continue

                    self._record_failure_health(rec, user_id, kind, str(exc), policy)

                    # STRICT POLICY: Never rotate keys under the SAME provider_type to bypass quotas or rate limits
                    if kind == "quota_or_rate_limit":
                        queue = [(c, m) for c, m in queue if c.provider_type != rec.provider_type]
                    break

        raise RuntimeError(f"All compatible providers failed for '{task_key}'. Attempts: {attempts}")

    def _record_failure_health(
        self,
        rec: ProviderConfigRecord,
        user_id: str,
        kind: str,
        message: str,
        policy: HealthPolicy,
    ) -> None:
        rec.consecutive_failures += 1
        if kind == "auth_error":
            rec.health_status = "failed"
            if policy.auto_disable_on_auth_error:
                rec.enabled = False
        elif kind == "quota_or_rate_limit":
            rec.health_status = "cooldown"
            rec.cooldown_until = datetime.now(timezone.utc) + timedelta(seconds=policy.cooldown_seconds)
        else:
            if rec.consecutive_failures >= policy.max_consecutive_failures:
                rec.health_status = "failed"
                rec.enabled = False
            else:
                rec.health_status = "degraded"

        self.health_history.append(
            {
                "user_id": user_id,
                "config_id": rec.id,
                "provider_name": rec.provider_name,
                "status": rec.health_status,
                "error_kind": kind,
                "error_message": message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        self.notifications.append(
            {
                "user_id": user_id,
                "category": "provider_failure",
                "title": f"Provider failure: {rec.provider_name}",
                "message": f"{kind}: {message}",
            }
        )

    def recover_configuration(self, config_id: str, user_id: str) -> ProviderConfigRecord:
        rec = self._configs.get(config_id)
        if not rec or rec.user_id != user_id:
            raise KeyError("Configuration not found for user.")
        rec.enabled = True
        rec.health_status = "untested"
        rec.consecutive_failures = 0
        rec.cooldown_until = None
        return rec

    def export_secret_free_config(self, user_id: str) -> dict[str, Any]:
        return {
            "schema_version": "kdp-studio-api-config-v1",
            "secret_included": False,
            "configs": [self.get_public_config(c.id, user_id) for c in self._configs.values() if c.user_id == user_id],
            "task_assignments": [v for (uid, _), v in self._task_assignments.items() if uid == user_id],
        }
