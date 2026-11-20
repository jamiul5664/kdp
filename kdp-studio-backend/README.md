# KDP Studio AI — Backend Architecture & Development Roadmap

Modular FastAPI + Multi-Agent + Celery backend powering **KDP Studio AI** for Amazon KDP market research, niche intelligence, conversational approval workflows, per-page book editing, dynamic KDP cover calculation, SEO compliance, and backend-confirmed print exports.

## Directory Structure

```text
kdp-studio-backend/
├── app/
│   ├── main.py                  # FastAPI entry point, lifespan, CORS, router registration
│   ├── api/                     # Versioned REST & SSE routers (12 domain modules)
│   │   ├── auth.py
│   │   ├── chat.py
│   │   ├── research.py
│   │   ├── niches.py
│   │   ├── projects.py
│   │   ├── books.py
│   │   ├── pages.py
│   │   ├── illustrations.py
│   │   ├── covers.py
│   │   ├── approvals.py
│   │   ├── exports.py
│   │   └── settings.py
│   ├── agents/                  # Multi-agent orchestration & specialized publishing agents
│   │   ├── orchestrator.py
│   │   ├── research_agent.py
│   │   ├── niche_agent.py
│   │   ├── competitor_agent.py
│   │   ├── review_agent.py
│   │   ├── planner_agent.py
│   │   ├── writing_agent.py
│   │   ├── illustration_agent.py
│   │   ├── cover_agent.py
│   │   ├── seo_agent.py
│   │   └── quality_agent.py
│   ├── integrations/            # External provider adapters
│   │   ├── llm/                 # Gemini LLM client
│   │   ├── amazon/              # Marketplace catalog & listing observation adapter
│   │   ├── google_trends/       # Search interest & seasonality adapter
│   │   ├── image_generation/    # Illustration & cover art generation adapter
│   │   └── storage/             # Local filesystem & S3-compatible artifact storage
│   ├── services/                # Business logic & KDP print math
│   │   ├── research_service.py
│   │   ├── book_service.py
│   │   ├── pdf_service.py
│   │   ├── cover_service.py
│   │   ├── seo_service.py
│   │   └── approval_service.py
│   ├── models/                  # SQLAlchemy ORM models
│   ├── schemas/                 # Pydantic v2 request/response schemas
│   ├── tasks/                   # Async Celery task definitions
│   ├── workers/                 # Celery worker configuration & bootstrap
│   ├── core/                    # Config, async DB session, JWT security, logging
│   └── utils/                   # KDP trim/spine/bleed calculator & SEO compliance validators
├── migrations/                  # Alembic database migrations
├── tests/                       # Pytest API & unit test suite
├── storage/                     # Local generated PDFs, covers, previews, and ZIPs
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
```

## Backend Development Roadmap

### Phase 1 — Core Foundation & Auth
- Configure `app/core/` (Pydantic settings, async SQLAlchemy engine, JWT auth, structured logging).
- Provision PostgreSQL + Redis via `docker-compose.yml` and initialize Alembic migrations (`migrations/`).
- Expose `/api/v1/auth` and `/api/v1/settings` endpoints with user profile & publisher imprint storage.

### Phase 2 — Conversational Orchestrator & Approvals
- Connect `app/agents/orchestrator.py` to `app/integrations/llm/` with Server-Sent Events (`app/api/chat.py`).
- Persist human-in-the-loop approval gates (`app/services/approval_service.py`, `app/api/approvals.py`) so book creation, cover generation, and export pipelines require explicit user sign-off.

### Phase 3 — Grounded Market Research & Niche Intelligence
- Orchestrate `research_agent.py`, `niche_agent.py`, `competitor_agent.py`, and `review_agent.py` via `research_service.py`.
- Enforce transparent provenance schemas separating **measured marketplace observations** (competitor count, review averages, price ranges, source URLs) from **AI-estimated scores**.
- Offload deep niche crawls to Celery workers (`app/tasks/research_tasks.py`).

### Phase 4 — Book Architecture, Per-Page Editor & Illustrations
- Manage projects, books, and independent per-page JSON element models (`app/api/projects.py`, `books.py`, `pages.py`).
- Wire `planner_agent.py`, `writing_agent.py`, and `illustration_agent.py` to generate outlines, chapter prose, and high-resolution interior plates without flattening pages.

### Phase 5 — Dynamic Cover Studio, SEO Compliance & Print-Ready Exports
- Compute dynamic KDP spine width (`page_count × paper_caliper`) and full-wrap 300 DPI dimensions in `app/utils/kdp_dimensions.py` & `app/services/cover_service.py`.
- Validate 7 backend keyword slots, duplicate terms, and trademark restrictions in `app/services/seo_service.py` + `seo_agent.py`.
- Run `quality_agent.py` preflight checks and generate backend-confirmed Interior PDF, Full Cover PDF, Metadata JSON, Book Preview HTML, and Complete ZIP bundles in `app/services/pdf_service.py` & `app/tasks/export_tasks.py`.

## Local Setup & Commands

```bash
# 1. Create virtual environment & install dependencies
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 2. Configure environment variables
cp .env.example .env

# 3. Start Postgres & Redis
docker compose up -d postgres redis

# 4. Run database migrations
alembic upgrade head

# 5. Start FastAPI server (http://localhost:8000/docs)
uvicorn app.main:app --reload --port 8000

# 6. Start Celery worker
celery -A app.workers.celery_app worker --loglevel=info

# 7. Run test suite
pytest
```
