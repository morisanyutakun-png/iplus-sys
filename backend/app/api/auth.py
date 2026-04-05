from fastapi import APIRouter, Depends, HTTPException, Cookie, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.auth.jwt import create_access_token, create_refresh_token, decode_refresh_token
from app.auth.password import verify_password, hash_password
from app.auth.dependencies import get_current_user, require_admin
from app.config import settings

router = APIRouter()

COOKIE_OPTS = dict(httponly=True, secure=True, samesite="none", path="/")


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    role: UserRole

    model_config = {"from_attributes": True}


class CreateTrainerRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8)


class UpdatePasswordRequest(BaseModel):
    password: str = Field(..., min_length=8)


# ──────────────────────────────────────────────
# Auth endpoints
# ──────────────────────────────────────────────
@router.post("/login")
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.username == body.username, User.is_active == True)
    )
    user = result.scalars().first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    access_token = create_access_token(
        user.id, user.role.value,
        settings.jwt_secret,
        settings.access_token_expire_minutes,
    )
    refresh_token = create_refresh_token(
        user.id,
        settings.jwt_secret,
        settings.refresh_token_expire_days,
    )

    response.set_cookie(
        "access_token", access_token,
        max_age=settings.access_token_expire_minutes * 60,
        **COOKIE_OPTS,
    )
    response.set_cookie(
        "refresh_token", refresh_token,
        max_age=settings.refresh_token_expire_days * 86400,
        **COOKIE_OPTS,
    )

    return UserOut.model_validate(user)


@router.post("/refresh")
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    payload = decode_refresh_token(refresh_token, settings.jwt_secret)
    user_id = int(payload["sub"])

    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_access = create_access_token(
        user.id, user.role.value,
        settings.jwt_secret,
        settings.access_token_expire_minutes,
    )
    response.set_cookie(
        "access_token", new_access,
        max_age=settings.access_token_expire_minutes * 60,
        **COOKIE_OPTS,
    )
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", samesite="none", secure=True)
    response.delete_cookie("refresh_token", path="/", samesite="none", secure=True)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


# ──────────────────────────────────────────────
# User management (admin only)
# ──────────────────────────────────────────────
@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.created_at))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.post("/users", response_model=UserOut, status_code=201)
async def create_trainer(
    body: CreateTrainerRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        role=UserRole.trainer,
        created_by=admin.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.put("/users/{user_id}/password", status_code=200)
async def update_password(
    user_id: int,
    body: UpdatePasswordRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.hashed_password = hash_password(body.password)
    await db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Cannot delete admin accounts")
    user.is_active = False
    await db.commit()
