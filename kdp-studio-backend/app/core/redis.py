from typing import Optional
import redis.asyncio as aioredis
from app.core.config import get_settings

_redis_client: Optional[aioredis.Redis] = None


def get_redis_client() -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis_client


async def close_redis_client() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.close()
        _redis_client = None


async def check_redis_health() -> bool:
    try:
        client = get_redis_client()
        return bool(await client.ping())
    except Exception:
        return False
