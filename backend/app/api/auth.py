from fastapi import APIRouter, Depends, HTTPException, Cookie, Response, status
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.auth.jwt import create_access_token, create_refresh_token, decode_refresh_token
from app.auth.dependencies import get_current_user, require_admin
from app.config import settings

router = APIRouter()

COOKIE_OPTS = dict(httponly=True, secure=True, samesite="none", path="/")


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────
class GoogleLoginRequest(BaseModel):
    credential: str  # Google ID token (JWT) from Google Identity Services


class UserOut(BaseModel):
    id: int
    username: str
    google_email: str | None
    role: UserRole

    model_config = {"from_attributes": True}


class CreateUserRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=64)
    google_email: str = Field(..., max_length=256)
    role: UserRole = UserRole.trainer


# ──────────────────────────────────────────────
# Google login
# ──────────────────────────────────────────────
def _verify_google_token(credential: str) -> dict:
    """Verify a Google ID token and return the payload."""
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    if not settings.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google認証が設定されていません（GOOGLE_CLIENT_IDを設定してください）",
        )
    try:
        return id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            settings.google_client_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Googleトークンが無効です: {e}",
        )


def _issue_tokens(user: User, response: Response) -> UserOut:
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


@router.post("/google")
async def google_login(
    body: GoogleLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    idinfo = _verify_google_token(body.credential)

    if not idinfo.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="メールアドレスが確認されていません")

    email = idinfo["email"]

    result = await db.execute(
        select(User).where(User.google_email == email, User.is_active == True)
    )
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="このGoogleアカウントはアクセスが許可されていません",
        )

    return _issue_tokens(user, response)


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
    result = await db.execute(select(User).where(User.is_active == True).order_by(User.created_at))
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(
    body: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Check google_email uniqueness
    existing_email = await db.execute(select(User).where(User.google_email == body.google_email))
    if existing_email.scalars().first():
        raise HTTPException(status_code=409, detail="このGoogleアカウントは既に登録されています")

    # Derive a unique username from display_name
    base_username = body.display_name
    username = base_username
    suffix = 1
    while True:
        existing_name = await db.execute(select(User).where(User.username == username))
        if not existing_name.scalars().first():
            break
        username = f"{base_username}{suffix}"
        suffix += 1

    user = User(
        username=username,
        google_email=body.google_email,
        role=body.role,
        created_by=admin.id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="自分自身は削除できません")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
