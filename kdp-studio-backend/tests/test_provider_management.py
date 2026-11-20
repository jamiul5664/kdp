import json
import unittest
from uuid import uuid4

try:
    from app.agents.orchestrator import AgentOrchestrator
except ModuleNotFoundError:
    AgentOrchestrator = None  # type: ignore

from app.services.provider_management import (
    HealthPolicy,
    ModelSpec,
    MultiProviderManager,
    SecretManager,
    validate_provider_url,
)


class _SimulatedProviderError(Exception):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class TestMultiProviderManagement(unittest.TestCase):
    def test_authenticated_secret_encryption_masking_and_tamper_detection(self) -> None:
        sm = SecretManager("test-master-secret-key-2026")
        raw = "sk-live-secret-998877665544332211"
        enc = sm.encrypt(raw, key_version=2)
        self.assertNotIn(raw, enc)
        self.assertEqual(sm.decrypt(enc), raw)

        masked = sm.mask(raw)
        self.assertNotIn("99887766", masked)
        self.assertTrue(masked.startswith("sk-l"))
        self.assertTrue(masked.endswith("2211"))

        # Tamper detection
        payload = json.loads(enc)
        payload["c"] = payload["c"][:-2] + ("AA" if not payload["c"].endswith("AA") else "BB")
        with self.assertRaises(Exception):
            sm.decrypt(json.dumps(payload))

    def test_ssrf_url_validation(self) -> None:
        self.assertEqual(
            validate_provider_url("https://openrouter.ai/api/v1/", "openrouter"),
            "https://openrouter.ai/api/v1",
        )
        for bad_url in [
            "http://169.254.169.254/latest/meta-data",
            "https://127.0.0.1:8000/v1",
            "https://10.0.0.5/v1",
            "https://metadata.google.internal/computeMetadata/v1",
            "http://api.openai.com/v1",
            "https://user:pass@api.openai.com/v1",
        ]:
            with self.assertRaises(ValueError):
                validate_provider_url(bad_url, "openai_compatible")

        # Local Ollama explicitly allowed when provider_type == ollama
        self.assertEqual(
            validate_provider_url("http://localhost:11434/", "ollama"),
            "http://localhost:11434",
        )

    def test_unlimited_multi_key_configs_and_strict_capability_enforcement(self) -> None:
        mgr = MultiProviderManager(SecretManager("unit-test-secret"))
        uid = str(uuid4())

        # Multiple keys under same provider type
        g1 = mgr.add_configuration(
            user_id=uid,
            provider_name="Gemini Key 1",
            provider_type="google_gemini",
            base_url="https://generativelanguage.googleapis.com/v1beta",
            api_key="AIzaSy-test-key-0001",
            models=[
                ModelSpec("gemini-2.5-flash", ["chat", "research", "writing", "vision"]),
                ModelSpec("imagen-3.0-generate-002", ["image_generation"]),
            ],
            priority=1,
        )
        g2 = mgr.add_configuration(
            user_id=uid,
            provider_name="Gemini Key 2",
            provider_type="google_gemini",
            base_url="https://generativelanguage.googleapis.com/v1beta",
            api_key="AIzaSy-test-key-0002",
            models=[ModelSpec("gemini-2.5-pro", ["chat", "research", "reasoning", "writing", "vision"])],
            priority=2,
        )
        text_only = mgr.add_configuration(
            user_id=uid,
            provider_name="DeepSeek Text Only",
            provider_type="deepseek",
            base_url="https://api.deepseek.com/v1",
            api_key="sk-deepseek-test-0001",
            models=[ModelSpec("deepseek-chat", ["chat", "writing", "coding"])],
            priority=5,
        )

        # Public view never leaks raw key
        pub = mgr.get_public_config(g1.id, uid)
        self.assertNotIn("AIzaSy-test-key-0001", json.dumps(pub))
        self.assertNotEqual(g1.id, g2.id)

        # Block image_generation on text-only model
        with self.assertRaises(ValueError):
            mgr.assign_task(
                user_id=uid,
                task_key="image_generation",
                primary_config_id=text_only.id,
                primary_model_id="deepseek-chat",
            )

        # Block vision task (pdf_quality_analysis) on non-vision model
        with self.assertRaises(ValueError):
            mgr.assign_task(
                user_id=uid,
                task_key="pdf_quality_analysis",
                primary_config_id=text_only.id,
                primary_model_id="deepseek-chat",
            )

        # Valid assignments succeed
        img_assign = mgr.assign_task(
            user_id=uid,
            task_key="image_generation",
            primary_config_id=g1.id,
            primary_model_id="imagen-3.0-generate-002",
        )
        self.assertEqual(img_assign["primary_model_id"], "imagen-3.0-generate-002")

        # Secret-free export never includes raw secrets
        exported = mgr.export_secret_free_config(uid)
        self.assertFalse(exported["secret_included"])
        self.assertNotIn("AIzaSy-test-key-0001", json.dumps(exported))
        self.assertNotIn("sk-deepseek-test-0001", json.dumps(exported))

    def test_policy_compliant_failover_blocks_same_provider_quota_rotation(self) -> None:
        mgr = MultiProviderManager(SecretManager("unit-test-secret"))
        uid = str(uuid4())
        mgr._health_policies[uid] = HealthPolicy(
            auto_disable_on_auth_error=True,
            max_consecutive_failures=2,
            cooldown_seconds=120,
            max_retries_per_request=2,
            forbid_quota_bypass_key_rotation=True,
        )

        # Two Gemini keys + one distinct OpenRouter backup
        gem1 = mgr.add_configuration(
            user_id=uid,
            provider_name="Gemini Key 1",
            provider_type="google_gemini",
            base_url="https://generativelanguage.googleapis.com/v1beta",
            api_key="AIza-key-1111111111",
            models=[ModelSpec("gemini-2.5-flash", ["chat", "writing"])],
            priority=1,
        )
        gem2 = mgr.add_configuration(
            user_id=uid,
            provider_name="Gemini Key 2",
            provider_type="google_gemini",
            base_url="https://generativelanguage.googleapis.com/v1beta",
            api_key="AIza-key-2222222222",
            models=[ModelSpec("gemini-2.5-flash", ["chat", "writing"])],
            priority=2,
        )
        openrouter = mgr.add_configuration(
            user_id=uid,
            provider_name="OpenRouter Backup",
            provider_type="openrouter",
            base_url="https://openrouter.ai/api/v1",
            api_key="sk-or-v1-backup-1234",
            models=[ModelSpec("anthropic/claude-3.7-sonnet", ["chat", "writing"])],
            priority=3,
        )

        called_ids: list[str] = []

        def fake_executor(rec, model_id):
            called_ids.append(rec.id)
            if rec.id == gem1.id:
                raise _SimulatedProviderError("HTTP 429 Quota exceeded / rate limit", status_code=429)
            return {"text": f"ok via {model_id}", "prompt_tokens": None, "completion_tokens": None, "estimated_cost_usd": None}

        outcome = mgr.execute_with_failover(user_id=uid, task_key="book_writing", executor=fake_executor)
        # Must skip gem2 (same provider_type as gem1 on 429) and fail over legitimately to openrouter
        self.assertEqual(called_ids, [gem1.id, openrouter.id])
        self.assertNotIn(gem2.id, called_ids)
        self.assertEqual(outcome["used_config_id"], openrouter.id)
        self.assertTrue(outcome["fallback_used"])
        self.assertEqual(gem1.health_status, "cooldown")
        self.assertGreaterEqual(len(mgr.notifications), 1)

        # Manual recovery restores cooldown state cleanly
        recovered = mgr.recover_configuration(gem1.id, uid)
        self.assertTrue(recovered.enabled)
        self.assertIsNone(recovered.cooldown_until)

    def test_auth_error_never_retried_and_orchestrator_route_integration(self) -> None:
        mgr = MultiProviderManager(SecretManager("unit-test-secret"))
        uid = uuid4()
        uid_str = str(uid)

        bad_key = mgr.add_configuration(
            user_id=uid_str,
            provider_name="Invalid OpenAI Key",
            provider_type="openai",
            base_url="https://api.openai.com/v1",
            api_key="sk-invalid-000000",
            models=[ModelSpec("gpt-4o", ["chat", "research", "writing"])],
            priority=1,
        )
        good_backup = mgr.add_configuration(
            user_id=uid_str,
            provider_name="Healthy OpenRouter",
            provider_type="openrouter",
            base_url="https://openrouter.ai/api/v1",
            api_key="sk-or-valid-999999",
            models=[ModelSpec("google/gemini-2.5-pro", ["chat", "research", "reasoning", "writing"])],
            priority=2,
        )

        call_counts = {bad_key.id: 0, good_backup.id: 0}

        def auth_fail_executor(rec, model_id):
            call_counts[rec.id] += 1
            if rec.id == bad_key.id:
                raise _SimulatedProviderError("401 Unauthorized: invalid api key", status_code=401)
            return {"ok": True}

        res = mgr.execute_with_failover(user_id=uid_str, task_key="market_research", executor=auth_fail_executor)
        # Permanent auth error must be attempted once only (zero retries) and auto-disabled
        self.assertEqual(call_counts[bad_key.id], 1)
        self.assertFalse(bad_key.enabled)
        self.assertEqual(res["used_config_id"], good_backup.id)

        # Smart router candidate resolution works directly and via AgentOrchestrator
        candidates = mgr.resolve_route_candidates(user_id=uid_str, task_key="market_research")
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0][0].id, good_backup.id)
        self.assertEqual(candidates[0][1], "google/gemini-2.5-pro")

        if AgentOrchestrator is not None:
            orchestrator = AgentOrchestrator(provider_manager=mgr)
            route = orchestrator.resolve_task_route(uid, "market_research")
            self.assertIsNotNone(route)
            assert route is not None
            self.assertEqual(route["config_id"], good_backup.id)
            self.assertEqual(route["model_id"], "google/gemini-2.5-pro")


if __name__ == "__main__":
    unittest.main()
