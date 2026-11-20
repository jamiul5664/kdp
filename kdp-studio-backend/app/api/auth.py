from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.core.exception_handlers import AppError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.entities import User, UserSetting
from app.schemas.dto import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.execute(select(User).where(User.email == payload.email.lower()))
    if existing.scalar_one_or_none():
        raise AppError("An account with this email already exists.", status.HTTP_409_CONFLICT, "EMAIL_EXISTS")

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        imprint_name=payload.imprint_name,
    )
    db.add(user)
    await db.flush()
    db.add(UserSetting(user_id=user.id))
    await db.commit()
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    res = await db.execute(select(User).where(User.email == payload.email.lower()))
    user = res.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise AppError("Invalid email or password.", status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS")
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/me")
async def me(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise AppError("User not found.", status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND")
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "imprint_name": user.imprint_name,
    }
