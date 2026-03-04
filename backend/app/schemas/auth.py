from typing import Literal

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_expires_in: int | None = None


class RegisterResponse(BaseModel):
    status: Literal["verified", "pending_email_verification"]
    message: str
    user_email: EmailStr
    access_token: str | None = None
    refresh_token: str | None = None
    expires_in: int | None = None
    token_type: Literal["bearer"] | None = None
