from typing import Any

import httpx

from app.core.config import settings
from app.schemas.auth import RegisterResponse, TokenResponse


class SupabaseAuthError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def register_with_supabase(email: str, password: str, full_name: str | None = None) -> RegisterResponse:
    payload: dict[str, Any] = {
        "email": email.strip().lower(),
        "password": password,
    }
    if full_name is not None and full_name.strip():
        payload["data"] = {"full_name": full_name.strip()}

    response_payload = _request_supabase("POST", "/signup", payload=payload, operation="registration")
    user_payload = response_payload.get("user") if isinstance(response_payload.get("user"), dict) else {}
    user_email = user_payload.get("email") if isinstance(user_payload.get("email"), str) else payload["email"]

    session_payload = response_payload.get("session")
    if isinstance(session_payload, dict):
        token_response = _normalize_token_response(session_payload)
        return RegisterResponse(
            status="verified",
            message="Registration succeeded.",
            user_email=user_email,
            access_token=token_response.access_token,
            refresh_token=token_response.refresh_token,
            expires_in=token_response.expires_in,
            token_type="bearer",
        )

    return RegisterResponse(
        status="pending_email_verification",
        message="Registration created. Verify your email before logging in.",
        user_email=user_email,
        access_token=None,
        refresh_token=None,
        expires_in=None,
        token_type=None,
    )


def login_with_supabase(email: str, password: str) -> TokenResponse:
    payload = {
        "email": email.strip().lower(),
        "password": password,
    }
    response_payload = _request_supabase(
        "POST",
        "/token?grant_type=password",
        payload=payload,
        operation="login",
    )
    return _normalize_token_response(response_payload)


def refresh_with_supabase(refresh_token: str) -> TokenResponse:
    payload = {"refresh_token": refresh_token}
    response_payload = _request_supabase(
        "POST",
        "/token?grant_type=refresh_token",
        payload=payload,
        operation="token refresh",
    )
    return _normalize_token_response(response_payload)


def _request_supabase(method: str, path: str, payload: dict[str, Any], operation: str) -> dict[str, Any]:
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1{path}"
    headers = {
        "apikey": settings.supabase_anon_key,
        "Authorization": f"Bearer {settings.supabase_anon_key}",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=settings.supabase_auth_timeout_seconds) as client:
            response = client.request(method=method, url=url, headers=headers, json=payload)
    except httpx.RequestError as exc:
        raise SupabaseAuthError(status_code=502, detail="Failed to reach Supabase Auth service.") from exc

    if response.status_code < 300:
        try:
            parsed = response.json()
        except ValueError as exc:
            raise SupabaseAuthError(status_code=502, detail="Supabase Auth returned invalid JSON.") from exc
        if not isinstance(parsed, dict):
            raise SupabaseAuthError(status_code=502, detail="Supabase Auth returned invalid response format.")
        return parsed

    error_payload = _parse_error_payload(response)
    mapped_status, mapped_detail = _map_supabase_error(
        status_code=response.status_code,
        error_message=error_payload["message"],
        error_code=error_payload["error_code"],
        operation=operation,
    )
    raise SupabaseAuthError(status_code=mapped_status, detail=mapped_detail)


def _normalize_token_response(payload: dict[str, Any]) -> TokenResponse:
    access_token = payload.get("access_token")
    refresh_token = payload.get("refresh_token")
    expires_in = payload.get("expires_in")
    token_type = payload.get("token_type")

    if not isinstance(access_token, str) or not access_token.strip():
        raise SupabaseAuthError(status_code=502, detail="Supabase token response missing access_token.")
    if not isinstance(refresh_token, str) or not refresh_token.strip():
        raise SupabaseAuthError(status_code=502, detail="Supabase token response missing refresh_token.")
    if not isinstance(expires_in, int):
        raise SupabaseAuthError(status_code=502, detail="Supabase token response missing expires_in.")
    if not isinstance(token_type, str) or token_type.lower() != "bearer":
        raise SupabaseAuthError(status_code=502, detail="Supabase token response missing token_type.")

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=expires_in,
        refresh_expires_in=None,
    )


def _parse_error_payload(response: httpx.Response) -> dict[str, str]:
    default_message = f"Supabase auth request failed with status {response.status_code}."
    try:
        payload = response.json()
    except ValueError:
        return {"message": default_message, "error_code": ""}

    if not isinstance(payload, dict):
        return {"message": default_message, "error_code": ""}

    message: str | None = None
    for key in ("msg", "message", "error_description", "error"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            message = value.strip()
            break

    error_code = payload.get("error_code")
    if not isinstance(error_code, str):
        error_code = ""

    return {
        "message": message or default_message,
        "error_code": error_code,
    }


def _map_supabase_error(status_code: int, error_message: str, error_code: str, operation: str) -> tuple[int, str]:
    normalized_message = error_message.lower()
    normalized_code = error_code.lower()

    if "invalid api key" in normalized_message or "api key" in normalized_message and status_code in {400, 401, 403}:
        return 502, "Supabase auth is misconfigured. Set a valid SUPABASE_ANON_KEY."

    if status_code == 429:
        return 429, "Supabase auth rate limit exceeded. Try again later."

    if normalized_code == "email_not_confirmed" or "email not confirmed" in normalized_message:
        return 403, "Email not confirmed. Verify your email before logging in."

    if normalized_code == "invalid_credentials" or "invalid login credentials" in normalized_message:
        return 401, "Invalid email or password."

    if "user already registered" in normalized_message:
        return 400, "Email is already registered."

    if status_code in {400, 422}:
        return 400, error_message or f"Supabase {operation} failed."

    if status_code >= 500:
        return 502, "Supabase auth provider error."

    return 400, error_message or f"Supabase {operation} failed."
