"""Token authentication, role-based access control and audit security middleware."""

import json
import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings
from app.domain.audit import AuditEvent
from app.domain.models import UserRole
from app.persistence.audit_ledger import LEDGER

logger = logging.getLogger("crisisroute.security")

_bearer = HTTPBearer(auto_error=False, description="JWT obtained from POST /auth/login")


class CurrentUser(BaseModel):
    """Authenticated user context."""

    user_id: str
    username: str
    role: UserRole


# ----------------------------------------------------------------------
# Tokens
# ----------------------------------------------------------------------


def create_access_token(
    user_id: str,
    username: str,
    role: UserRole,
    expires_minutes: int | None = None,
) -> str:
    """Issue a signed JWT carrying the operator identity and role."""
    now = datetime.now(UTC)
    ttl = (
        expires_minutes if expires_minutes is not None else settings.jwt_access_token_expire_minutes
    )
    claims = {
        "sub": user_id,
        "username": username,
        "role": role.value,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl)).timestamp()),
    }
    return jwt.encode(claims, str(settings.jwt_secret_key), algorithm=settings.jwt_algorithm)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    """Resolve the caller from a verified bearer token. Identity is never read from headers."""
    if credentials is None:
        raise _unauthorized("Authentication required")
    try:
        claims = jwt.decode(
            credentials.credentials,
            str(settings.jwt_secret_key),
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
        return CurrentUser(
            user_id=str(claims["sub"]),
            username=str(claims.get("username") or claims["sub"]),
            role=UserRole(claims["role"]),
        )
    except jwt.ExpiredSignatureError as err:
        raise _unauthorized("Session expired, please sign in again") from err
    except (jwt.InvalidTokenError, KeyError, ValueError) as err:
        raise _unauthorized("Invalid authentication token") from err


def require_role(allowed_roles: list[UserRole]) -> Callable[[CurrentUser], CurrentUser]:
    """Dependency factory enforcing strict role-based access control."""

    def role_checker(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in allowed_roles:
            valid_roles = [r.value for r in allowed_roles]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"User role '{current_user.role.value}' lacks required permission. "
                    f"Must be one of {valid_roles}."
                ),
            )
        return current_user

    return role_checker


# ----------------------------------------------------------------------
# Login throttling
# ----------------------------------------------------------------------

_FAILED_LOGINS: dict[str, list[float]] = {}


def check_login_allowed(key: str) -> None:
    """Raise 429 if too many recent failures were recorded for this key."""
    now = time.monotonic()
    window = settings.login_lockout_seconds
    recent = [t for t in _FAILED_LOGINS.get(key, []) if now - t < window]
    _FAILED_LOGINS[key] = recent
    if len(recent) >= settings.login_max_failures:
        retry = max(1, int(window - (now - recent[0])))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed sign-in attempts. Try again in {retry} seconds.",
            headers={"Retry-After": str(retry)},
        )


def record_login_failure(key: str) -> None:
    _FAILED_LOGINS.setdefault(key, []).append(time.monotonic())


def clear_login_failures(key: str) -> None:
    _FAILED_LOGINS.pop(key, None)


# ----------------------------------------------------------------------
# Audit
# ----------------------------------------------------------------------


def record_audit_event(
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    """Append a hash-chained entry to the audit ledger."""
    event = LEDGER.append(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
    )
    logger.info("AUDIT_EVENT: %s", json.dumps(event.model_dump()))
    return event


async def audit_logging_middleware(request: Request, call_next: Callable) -> Any:
    """Attach a correlation ID, security headers and log each request outcome."""
    correlation_id = request.headers.get("X-Correlation-Id", str(uuid4()))
    request.state.correlation_id = correlation_id
    started = time.perf_counter()

    response = await call_next(request)

    elapsed_ms = (time.perf_counter() - started) * 1000
    response.headers["X-Correlation-Id"] = correlation_id
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    logger.info(
        "%s %s -> %s (%.1f ms) cid=%s",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
        correlation_id,
    )
    return response
