from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import AuthenticatedPrincipal, TokenValidationError, create_access_token, create_refresh_token, decode_token
from app.db import models
from app.db.session import get_db
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterResponse, TokenResponse
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import authenticate_user, create_user
from app.services.supabase_auth_service import (
    SupabaseAuthError,
    login_with_supabase,
    refresh_with_supabase,
    register_with_supabase,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=RegisterResponse | UserRead, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, response: Response, db: Session = Depends(get_db)) -> RegisterResponse | models.User:
    if settings.auth_provider.strip().lower() == "supabase":
        try:
            register_response = register_with_supabase(
                email=payload.email,
                password=payload.password,
                full_name=payload.full_name,
            )
        except SupabaseAuthError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

        if register_response.status == "pending_email_verification":
            response.status_code = status.HTTP_202_ACCEPTED
        return register_response

    return create_user(db=db, email=payload.email, password=payload.password, full_name=payload.full_name)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if settings.auth_provider.strip().lower() == "supabase":
        try:
            return login_with_supabase(email=payload.email, password=payload.password)
        except SupabaseAuthError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    user = authenticate_user(db=db, email=payload.email, password=payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
        refresh_expires_in=settings.refresh_token_expire_days * 24 * 60 * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if settings.auth_provider.strip().lower() == "supabase":
        try:
            return refresh_with_supabase(payload.refresh_token)
        except SupabaseAuthError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    try:
        user_id = decode_token(payload.refresh_token, expected_token_type="refresh")
    except TokenValidationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token.") from exc

    user = db.get(models.User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
        refresh_expires_in=settings.refresh_token_expire_days * 24 * 60 * 60,
    )


@router.get("/me")
def read_me(current_user: models.User | AuthenticatedPrincipal = Depends(get_current_user)) -> dict[str, object]:
    if isinstance(current_user, AuthenticatedPrincipal):
        return {
            "provider": "supabase",
            "id": current_user.subject,
            "email": current_user.email,
            "role": current_user.role,
        }

    return {
        "provider": "local",
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at.isoformat(),
    }
