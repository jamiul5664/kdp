# KDP Studio AI — Security & Privacy Report

**Audit Date:** 2026-11-20

## 1. Secrets & Provider Key Handling
- **Status: PASS**
- `GEMINI_API_KEY` is read exclusively server-side (`process.env.GEMINI_API_KEY` in `server.ts`, `Settings.gemini_api_key` in `/kdp-studio-backend/app/core/config.py`).
- Zero API secrets are embedded in `VITE_*` client environment variables or frontend bundles.

## 2. Authentication, Authorization & Multi-Tenant Data Isolation
- **Status: HARDENED**
- FastAPI backend enforces JWT bearer auth (`app/api/deps.py`) with salted password hashing (`app/core/security.py`).
- **Project Memory (`pgvector`)** strictly filters every query and update by `(user_id, project_id)` — verified by unit test `test_project_memory_isolation_and_approval_lock` (cross-user and cross-project retrieval returns 0 unrelated records).
- **Performance Learning CSV Data** is scoped per user with explicit export and delete-all controls.
- **Recommendation before public multi-tenant launch:** Enforce JWT session validation middleware on Express proxy endpoints when deploying Express directly instead of routing through the FastAPI gateway.

## 3. Approval Gate & Integrity Controls
- **Status: PASS**
- Workflow automation enforces mandatory human approval checkpoints; attempting to advance an approval step with `user_approved=False` raises `PermissionError` (HTTP `403`).
- Approved book pages and approved project memory records cannot be silently overwritten by automated agents.
- Idempotency keys (`workflow_runs.idempotency_key`) prevent duplicate execution and double-charging of image/LLM providers.

## 4. Privacy & Compliance Safeguards
- **PII Anonymization**: Customer review ingestion strips emails, social handles, and reviewer names before analysis or storage.
- **Opt-In Scheduled Research**: Both Express (`PUT /api/schedules`) and Celery (`run_scheduled_niche_research`) reject execution unless `enabled === true && userConsentGranted === true`.
- **No Fabricated Data or False Legal Claims**:
  - Unverified keyword search volumes are marked `"Unavailable"`.
  - Originality & trademark checks explicitly disclaim copyright ownership proof and trademark clearance, flagging uncertain items for human legal review.
  - Compliance checks explicitly state they never guarantee Amazon KDP acceptance.
