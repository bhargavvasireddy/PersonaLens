from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.db import models


def create_user(db: Session, email: str, password: str, full_name: str | None) -> models.User:
    normalized_email = email.strip().lower()
    existing = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Email is already registered.")

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user = models.User(
        email=normalized_email,
        password_hash=hash_password(password),
        full_name=full_name.strip() if full_name is not None and full_name.strip() else None,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> models.User | None:
    normalized_email = email.strip().lower()
    user = db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user

