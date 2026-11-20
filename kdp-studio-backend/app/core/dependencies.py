from typing import Optional
from uuid import UUID
from fastapi import Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.exception_handlers import AppError
from app.core.security import decode_access_token
from app.integrations.llm.router import LLMRouter, get_default_llm_router


async def get_current_user_id(
    authorization: Optional[str] = Header(default=None),
) -> UUID:
    """Validate Bearer JWT token and return authenticated user UUID."""
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(
            message="Missing or invalid Authorization Bearer token.",
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="UNAUTHORIZED",
        )
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        raise AppError(
            message="Invalid or expired access token.",
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="TOKEN_INVALID",
        )
    try:
        return UUID(str(payload["sub"]))
    except ValueError as exc:
        raise AppError(
            message="Malformed user identifier in token.",
            status_code=status.HTTP_401_UNAUTHORIZED,
            code="TOKEN_MALFORMED",
        ) from exc


def get_llm_router() -> LLMRouter:
    return get_default_llm_router()


DbSessionDep = Depends(get_db)
CurrentUserIdDep = Depends(get_current_user_id)
LLMRouterDep = Depends(get_llm_router)
