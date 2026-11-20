from typing import Any, Dict
from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user_id, get_llm_router
from app.integrations.llm.router import LLMRouter
from app.models.entities import UserSetting
from app.schemas.dto import SettingsUpdateRequest

router = APIRouter()


@router.get("/")
async def get_settings(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    llm_router: LLMRouter = Depends(get_llm_router),
) -> Dict[str, Any]:
    """Returns user preferences and sanitized gateway usage metrics (never exposes API keys)."""
    res = await db.execute(select(UserSetting).where(UserSetting.user_id == user_id))
    pref = res.scalar_one_or_none()
    return {
        "preferences": {
            "theme": pref.theme if pref else "dark",
            "default_marketplace": pref.default_marketplace if pref else "amazon.com",
            "default_trim_size": pref.default_trim_size if pref else "6x9",
            "default_paper_type": pref.default_paper_type if pref else "white",
            "scoring_weights_json": pref.scoring_weights_json
            if pref and pref.scoring_weights_json
            else {
                "demand": 0.35,
                "competition_inverse": 0.30,
                "keyword_opportunity": 0.20,
                "market_gap": 0.15,
            },
        },
        "ai_gateway_usage": llm_router.usage_tracker.summary(),
    }


@router.patch("/")
async def update_settings(
    payload: SettingsUpdateRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    res = await db.execute(select(UserSetting).where(UserSetting.user_id == user_id))
    pref = res.scalar_one_or_none()
    if not pref:
        pref = UserSetting(user_id=user_id)
        db.add(pref)

    if payload.theme is not None:
        pref.theme = payload.theme
    if payload.default_marketplace is not None:
        pref.default_marketplace = payload.default_marketplace
    if payload.default_trim_size is not None:
        pref.default_trim_size = payload.default_trim_size
    if payload.default_paper_type is not None:
        pref.default_paper_type = payload.default_paper_type
    if payload.scoring_weights_json is not None:
        pref.scoring_weights_json = payload.scoring_weights_json

    await db.commit()
    return {"status": "updated"}
