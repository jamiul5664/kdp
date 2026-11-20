# KDP Studio AI — Automated Test Report

**Audit Date:** 2026-11-20  
**Environment:** Vite + React + TypeScript + Express (Port 3000) & Python 3.11+ FastAPI / SQLAlchemy 2 / Celery Backend (`/kdp-studio-backend/`)  
**Execution Policy:** Zero mock fallbacks hiding failures; all suites executed directly against live engines and live HTTP endpoints.

## 1. Execution Summary

| Suite | Command | Passed | Failed | Status |
| :--- | :--- | ---: | ---: | :--- |
| TypeScript Static Typecheck | `npm run lint` (`tsc --noEmit`) | All modules | 0 | **PASSED** |
| Production Frontend Bundle | `vite build` | All bundles | 0 | **PASSED** |
| TypeScript Unit Tests | `npx tsx tests/kdp_engines.test.ts` | 8 | 0 | **PASSED** |
| Python Bytecode Verification | `python3 -m compileall -q kdp-studio-backend/...` | All packages | 0 | **PASSED** |
| Python Backend Unit Tests | `python3 -m unittest -v kdp-studio-backend/tests/test_advanced_modules.py` | 3 | 0 | **PASSED** |
| Live E2E API Integration Suite | `node tests/e2e_api_journey.mjs` | 5 | 0 | **PASSED** |

## 2. Verified Functional Coverage

- **Seasonal KDP Calendar**: Verified all 11 events (`Christmas`, `Halloween`, `Easter`, `Valentine's Day`, `Mother's Day`, `Father's Day`, `Ramadan`, `Eid`, `Summer Vacation`, `Back to School`, `New Year`), 12-month historical curves, and lead-time deadlines.
- **Keyword Research Engine**: Verified CSV import/export, `"Unavailable"` tagging for missing volumes, title-word deduplication, and 50-character 7-slot KDP generation.
- **Review Intelligence PII Stripping**: Verified redaction of email addresses, social handles, and reviewer names (both lowercase and capitalized prefixes) in TypeScript and Python.
- **10-Template KDP Library**: Verified all 10 book types (`Coloring Book`, `Activity Book`, `Puzzle Book`, `Word Search`, `Sudoku`, `Children's Story`, `Guided Journal`, `Daily Planner`, `Educational Workbook`, `Large Print Book`).
- **15-Point Amazon KDP Compliance Checker**: Verified all 15 print/policy/metadata checks, versioned specification tracking, and non-guarantee disclaimer.
- **Copyright & Originality Auditor**: Verified restricted brand flagging, repeated page text detection, duplicate illustration tracking, and human-review flagging.
- **Profitability Calculator & Cover Math**: Verified Paperback/Hardcover KDP printing cost rules, 50%/60% royalty tiers, manual cost override, break-even calculations, and spine/bleed/300 DPI wrap calculations.
- **Durable Workflow Automation**: Verified idempotency key deduplication (`201 Created` -> `200 OK` deduplicated), pause/resume/cancel controls, mandatory human approval checkpoint enforcement (`PermissionError` on bypass attempt), and interrupted step recovery.
- **Persistent Project Memory (`pgvector`)**: Verified strict `(user_id, project_id)` isolation and `PermissionError` protection preventing silent overwrites of approved memory decisions.
- **Opt-In Scheduled Research**: Verified server and Celery workers refuse to enable or execute scheduled research when `userConsentGranted` is `false`.
- **Binary Export Pipeline**: Verified live HTTP binary downloads starting with `%PDF-` (Interior PDF & Full Cover Wrap PDF) and `PK` (Complete ZIP package).
