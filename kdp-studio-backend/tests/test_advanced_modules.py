from __future__ import annotations

import unittest

from app.services.advanced_engines import (
    DurableWorkflowService,
    ProjectMemoryService,
    calculate_kdp_profitability_py,
    can_execute_scheduled_research,
    strip_reviewer_pii,
)


class AdvancedKdpModulesTests(unittest.TestCase):
    def test_project_memory_isolation_and_approval_lock(self) -> None:
        svc = ProjectMemoryService()
        m1 = svc.add_memory(
            memory_id="m1",
            user_id="user_a",
            project_id="proj_1",
            memory_type="Book style profile",
            title="Bold 2.2pt floral line art",
            content="Single-sided botanical line art for alcohol markers.",
            approved=True,
            actor="clara",
        )
        svc.add_memory(
            memory_id="m2",
            user_id="user_a",
            project_id="proj_2",
            memory_type="Research findings",
            title="Unrelated space puzzle project",
            content="Space mazes for kids ages 6-8.",
            approved=False,
            actor="clara",
        )
        svc.add_memory(
            memory_id="m3",
            user_id="user_b",
            project_id="proj_1",
            memory_type="User preferences",
            title="Another user secret",
            content="Must never leak to user_a.",
            approved=False,
            actor="other",
        )

        # Retrieval must strictly isolate by user_id and project_id
        hits = svc.retrieve_for_project(user_id="user_a", project_id="proj_1", query="botanical markers")
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["id"], "m1")

        # Silent overwrite of approved memory must be blocked
        with self.assertRaises(PermissionError):
            svc.update_memory(
                memory_id=m1.id,
                user_id="user_a",
                new_content="Double-sided thin lines",
                actor="agent",
                explicit_override_approved=False,
            )

        # Explicit approved revision succeeds and records audit trail
        updated = svc.update_memory(
            memory_id=m1.id,
            user_id="user_a",
            new_content="Single-sided 2.4pt botanical line art",
            actor="clara",
            explicit_override_approved=True,
        )
        self.assertEqual(updated.version, 2)
        self.assertEqual(len(updated.audit_trail), 2)

    def test_durable_workflow_idempotency_approval_gate_and_recovery(self) -> None:
        wf = DurableWorkflowService()
        run1, dedup1 = wf.create_workflow(
            user_id="u1",
            project_id="p1",
            book_title="Wildflower Coloring",
            idempotency_key="key_001",
        )
        self.assertFalse(dedup1)
        run2, dedup2 = wf.create_workflow(
            user_id="u1",
            project_id="p1",
            book_title="Wildflower Coloring",
            idempotency_key="key_001",
        )
        self.assertTrue(dedup2)
        self.assertEqual(run1["id"], run2["id"])

        approval_task = run1["steps"][2]["task_id"]
        # Bypassing approval gate must raise PermissionError
        with self.assertRaises(PermissionError):
            wf.advance_step(run_id=run1["id"], user_id="u1", task_id=approval_task, user_approved=False)

        # Explicit approval advances workflow safely to next approval gate
        advanced = wf.advance_step(run_id=run1["id"], user_id="u1", task_id=approval_task, user_approved=True)
        self.assertEqual(advanced["steps"][2]["status"], "completed")
        self.assertEqual(advanced["steps"][3]["status"], "completed")
        self.assertEqual(advanced["status"], "waiting_approval")

        # Simulate interruption + durable checkpoint recovery
        advanced["steps"][4]["status"] = "failed"
        recovered = wf.control(run_id=run1["id"], user_id="u1", action="recover")
        self.assertEqual(recovered["status"], "waiting_approval")

    def test_pii_stripping_opt_in_schedule_and_profitability(self) -> None:
        cleaned = strip_reviewer_pii("Reviewer Jane Smith (@janesmith, jane@test.com) hated bleed-through")
        self.assertNotIn("jane@test.com", cleaned)
        self.assertNotIn("@janesmith", cleaned)
        self.assertNotIn("Jane Smith", cleaned)

        self.assertFalse(can_execute_scheduled_research(enabled=True, user_consent_granted=False))
        self.assertTrue(can_execute_scheduled_research(enabled=True, user_consent_granted=True))

        calc = calculate_kdp_profitability_py(
            book_format="Paperback",
            trim_size="8.5x11",
            page_count=104,
            ink_type="Black & White",
            list_price=12.99,
            production_cost=120.0,
            ad_cost_per_sale=1.0,
        )
        self.assertEqual(calc["royalty_rate"], 0.60)
        self.assertGreater(calc["royalty_per_sale"], 4.0)
        self.assertIsNotNone(calc["break_even_sales"])


if __name__ == "__main__":
    unittest.main()
