# KDP Studio AI — Bug Report & Resolution Log

**Audit Date:** 2026-11-20  
**Scope:** Full-Stack Integration Audit across Frontend (`src/`), Express API (`server.ts`), and Python FastAPI Backend (`kdp-studio-backend/`).

## Resolved Defects Found During Automated Audit

| ID | Severity | Component | Root Cause | Resolution & Verification |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-001** | **High** | `src/utils/kdpAdvancedEngines.ts` & `kdp-studio-backend/app/services/advanced_engines.py` | `stripReviewerPii` / `strip_reviewer_pii` used case-sensitive prefix matching `(?:by|reviewer|posted by)`, failing to redact capitalized `"Reviewer Jane Smith"` and `"Posted by John Doe"`. Caught by `test_pii_stripping_opt_in_schedule_and_profitability`. | Updated regex in both TS and Python to match capitalized prefixes cleanly; re-verified with unit tests (0 PII leaks). |
| **BUG-002** | **High** | `src/services/apiClient.ts` | `API_BASE` defaulted to `/api`, causing callers passing `/api/...` paths to request `/api/api/...` and missing `apiPut` / `apiGet` exports for schedule persistence. | Added `buildUrl()` prefix normalization plus `apiGet` and `apiPut` helpers; verified live `/api/schedules` PUT and `/api/intelligence/*` POST routes. |
| **BUG-003** | **Medium** | `src/app/studio-tools/page.tsx` | Flipbook Preview PDF download imported non-existent `../../services/exportService` instead of `../../services/studioService` and omitted required `coverSpec` & `trimSize` payload fields. | Switched import to `studioService.ts`, calculated `coverSpec` via `calculateFullCoverSpec`, and verified with `tsc --noEmit` + `vite build`. |
| **BUG-004** | **Medium** | `src/app/intelligence/page.tsx` | Niche Explorer tab imported `fetchMarketNiches` instead of exported `searchMarketNiches`. | Fixed import and call site; verified compilation and type safety. |
| **BUG-005** | **Low** | `src/utils/kdpAdvancedEngines.ts` | TypeScript inferred `relatedKeywords: []` as `never[]` inside `.map().filter()` type predicate in `parseKeywordsCsv`. | Refactored to strongly typed `KeywordResearchRecord[]` accumulator; `tsc --noEmit` now passes with 0 errors. |
| **BUG-006** | **High** | `src/app/research/page.tsx` & `src/services/researchService.ts` *(resolved earlier in cycle)* | Non-JSON server error payloads left `researchResults` undefined, throwing `TypeError: Cannot read properties of undefined (reading 'filter')`. | Added strict `Content-Type` JSON validation in `apiClient.ts` and array normalization guards in `researchService.ts` and `useAppStore.ts`. |

## Open / Advisory Observations (Non-Blocking for Staging)

- **OBS-001 (Storage Persistence)**: Express preview server (`server.ts`) uses in-memory `Map` stores for generated export buffers and workflow state during local dev; production deployment should back these with PostgreSQL + S3/R2 via `/kdp-studio-backend/`.
- **OBS-002 (External Live LLM Quota)**: Grounded Gemini calls (`/api/chat/stream`, `/api/research/niches`, `/api/intelligence/competitor-gap`, `/api/intelligence/keywords`) depend on valid `GEMINI_API_KEY` quota; errors now surface transparently as structured JSON without fabricating data.
