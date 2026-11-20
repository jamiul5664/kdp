# KDP Studio AI — Production Deployment Checklist

## 1. Infrastructure & Environment Variables
- [ ] Provision PostgreSQL 16+ with `pgvector` extension enabled (`CREATE EXTENSION IF NOT EXISTS vector;`).
- [ ] Provision Redis 7+ for Celery broker, result backend, and distributed rate limiting.
- [ ] Configure object storage bucket (S3 / Cloudflare R2 / GCS) with private ACLs and signed download URLs for print-ready PDFs and illustrations.
- [ ] Set server-only secrets (`GEMINI_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) via secret manager. Never expose secrets in `VITE_*` variables.
- [ ] Set `NODE_ENV=production` and `APP_ENV=production` (disables `/docs` and `/redoc` in FastAPI).

## 2. Database Migrations & Workers
- [ ] Run `alembic upgrade head` (applies `0001_initial_schema` and `0002_advanced_modules_pgvector`).
- [ ] Verify `ix_project_memories_user_project` and `ivfflat` vector cosine index exist in PostgreSQL.
- [ ] Launch Celery workers across dedicated queues:
  - `celery -A app.workers.celery_app worker -Q research --concurrency=2`
  - `celery -A app.workers.celery_app worker -Q generation --concurrency=2` *(respects `rate_limit="10/m"`)*
  - `celery -A app.workers.celery_app worker -Q exports --concurrency=2`

## 3. Application Build & Smoke Checks
- [ ] Build frontend: `npm run build` (`vite build`).
- [ ] Verify `tsc --noEmit` exits 0.
- [ ] Execute `npx tsx tests/kdp_engines.test.ts` and `PYTHONPATH=kdp-studio-backend python3 -m unittest discover -s kdp-studio-backend/tests`.
- [ ] Verify `/api/health` returns `200 OK` and FastAPI `/health` confirms PostgreSQL + Redis connectivity.
- [ ] Run `node tests/e2e_api_journey.mjs` against staging URL and confirm `%PDF-` and `PK` binary download headers.

## 4. Observability & Operations
- [ ] Configure structured JSON log aggregation and error alerting (Sentry / OpenTelemetry).
- [ ] Configure periodic cleanup lifecycle policy for expired temporary export ZIP archives.
- [ ] Enable HTTPS/TLS termination, strict CORS allowlist, and rate-limiting middleware on `/api/chat/*` and `/api/intelligence/*`.
