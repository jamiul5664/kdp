from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.exception_handlers import register_exception_handlers
from app.core.logging import configure_logging
from app.core.redis import check_redis_health, close_redis_client
from app.api import (
    advanced,
    approvals,
    auth,
    books,
    chat,
    covers,
    exports,
    illustrations,
    niches,
    pages,
    projects,
    providers,
    research,
    settings as settings_api,
)

settings = get_settings()
configure_logging(debug=settings.debug)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    await close_redis_client()


app = FastAPI(
    title=settings.app_name,
    description=(
        "Modular AI SaaS backend for Amazon KDP publishing workflows: compliant market research, "
        "transparent niche scoring, multi-agent orchestration with human approval gates, "
        "per-page book editing, dynamic KDP cover calculations, SEO compliance, and print exports."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

prefix = settings.api_v1_prefix
app.include_router(auth.router, prefix=f"{prefix}/auth", tags=["Auth"])
app.include_router(chat.router, prefix=f"{prefix}/chat", tags=["Chat"])
app.include_router(research.router, prefix=f"{prefix}/research", tags=["Research"])
app.include_router(niches.router, prefix=f"{prefix}/niches", tags=["Niches"])
app.include_router(projects.router, prefix=f"{prefix}/projects", tags=["Projects"])
app.include_router(books.router, prefix=f"{prefix}/books", tags=["Books"])
app.include_router(pages.router, prefix=f"{prefix}/pages", tags=["Pages"])
app.include_router(illustrations.router, prefix=f"{prefix}/illustrations", tags=["Illustrations"])
app.include_router(covers.router, prefix=f"{prefix}/covers", tags=["Covers"])
app.include_router(approvals.router, prefix=f"{prefix}/approvals", tags=["Approvals"])
app.include_router(exports.router, prefix=f"{prefix}/exports", tags=["Exports"])
app.include_router(settings_api.router, prefix=f"{prefix}/settings", tags=["Settings"])
app.include_router(providers.router, prefix=f"{prefix}/providers", tags=["AI Providers & Routing"])
app.include_router(advanced.router, prefix=f"{prefix}/advanced", tags=["Advanced Studio & Workflows"])


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, object]:
    redis_ok = await check_redis_health()
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.app_env,
        "api_version": settings.api_v1_prefix,
        "dependencies": {
            "redis": "connected" if redis_ok else "unavailable",
        },
    }
