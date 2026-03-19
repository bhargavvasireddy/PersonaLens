import logging
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from jwt import PyJWKClient
from jwt.exceptions import MissingCryptographyError, PyJWKClientError

from app.core.config import settings

logger = logging.getLogger(__name__)

_jwk_client: PyJWKClient | None = None


def _get_supabase_jwk_client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwk_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=300)
    return _jwk_client


class TokenValidationError(Exception):
    pass


class AuthenticatedPrincipal:
    def __init__(self, subject: str, email: str | None = None, role: str | None = None):
        self.subject = subject
        self.email = email
        self.role = role


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    return _create_token(user_id=user_id, token_type="access", expires_delta=timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(user_id: int) -> str:
    return _create_token(user_id=user_id, token_type="refresh", expires_delta=timedelta(days=settings.refresh_token_expire_days))


def decode_token(token: str, expected_token_type: str) -> int:
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.InvalidTokenError as exc:
        raise TokenValidationError("Invalid token.") from exc

    token_type = payload.get("type")
    if token_type != expected_token_type:
        raise TokenValidationError("Invalid token type.")

    subject = payload.get("sub")
    if subject is None:
        raise TokenValidationError("Token subject is missing.")

    try:
        return int(subject)
    except (TypeError, ValueError) as exc:
        raise TokenValidationError("Token subject is invalid.") from exc


def decode_supabase_access_token(token: str) -> AuthenticatedPrincipal:
    if not settings.supabase_url.strip():
        raise TokenValidationError("SUPABASE_URL is not configured.")
    try:
        unverified = jwt.get_unverified_header(token)
        if unverified.get("alg") != "ES256":
            raise TokenValidationError("Supabase access token must use ES256.")

        client = _get_supabase_jwk_client()
        signing_key = client.get_signing_key_from_jwt(token)
    except MissingCryptographyError as exc:
        logger.error("Missing dependency for ES256 verification: %s", exc)
        raise TokenValidationError("Server is missing JWT crypto dependency.") from exc
    except (jwt.InvalidTokenError, PyJWKClientError) as exc:
        logger.warning("Supabase JWT header/key resolution failed: %s", exc)
        raise TokenValidationError("Invalid Supabase token.") from exc

    verify_aud = bool(settings.supabase_jwt_audience.strip())
    options = {"verify_aud": verify_aud}
    decode_kwargs = {}
    if verify_aud:
        decode_kwargs["audience"] = settings.supabase_jwt_audience
    if settings.supabase_jwt_issuer:
        decode_kwargs["issuer"] = settings.supabase_jwt_issuer

    try:
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            options=options,
            **decode_kwargs,
        )
    except jwt.InvalidTokenError as exc:
        logger.warning("Supabase JWT verification failed: %s", exc)
        raise TokenValidationError("Invalid Supabase token.") from exc

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.strip():
        raise TokenValidationError("Token subject is missing.")

    email = payload.get("email")
    if email is not None and not isinstance(email, str):
        email = None

    role = payload.get("role")
    if role is not None and not isinstance(role, str):
        role = None

    return AuthenticatedPrincipal(subject=subject, email=email, role=role)


def _create_token(user_id: int, token_type: str, expires_delta: timedelta) -> str:
    expires_at = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
