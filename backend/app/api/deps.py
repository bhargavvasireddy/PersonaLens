from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    AuthenticatedPrincipal,
    TokenValidationError,
    decode_supabase_access_token,
    decode_token,
)
from app.db import models
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User | AuthenticatedPrincipal:
    if settings.auth_provider.strip().lower() == "supabase":
        try:
            return decode_supabase_access_token(token)
        except TokenValidationError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.") from exc

    try:
        user_id = decode_token(token, expected_token_type="access")
    except TokenValidationError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token.") from exc

    user = db.get(models.User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")
    return user


def get_owner_user_id(current_user: models.User | AuthenticatedPrincipal) -> str:
    if isinstance(current_user, AuthenticatedPrincipal):
        return f"supabase:{current_user.subject}"
    return f"local:{current_user.id}"


def get_default_project(db: Session, owner_user_id: str) -> models.Project:
    project = (
        db.query(models.Project)
        .filter(models.Project.owner_user_id == owner_user_id)
        .order_by(models.Project.created_at.asc(), models.Project.id.asc())
        .first()
    )
    if project is not None:
        return project

    project = models.Project(owner_user_id=owner_user_id, name="General")
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_project_for_owner(db: Session, owner_user_id: str, project_id: int) -> models.Project:
    project = (
        db.query(models.Project)
        .filter(models.Project.id == project_id, models.Project.owner_user_id == owner_user_id)
        .first()
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project
