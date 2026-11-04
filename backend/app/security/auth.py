"""Role-Based Access Control (RBAC) and audit security middleware."""

import json
import logging
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from fastapi import Depends, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.domain.models import UserRole

logger = logging.getLogger("crisisroute.security")


class CurrentUser(BaseModel):
    """Authenticated user context."""

    user_id: str
    username: str
    role: UserRole


class AuditEvent(BaseModel):
    """Immutable audit record for critical operational actions."""

    event_id: str
    timestamp: str
    user_id: str
    action: str
    resource_type: str
    resource_id: str
    details: dict[str, Any]


# In-memory audit trail buffer for development/testing
AUDIT_TRAIL: list[AuditEvent] = []


def get_current_user(
    x_user_id: str | None = Header(default="analyst-001"),
    x_user_role: str | None = Header(default=UserRole.ANALYST.value),
    x_username: str | None = Header(default="Farhan Aaqil"),
) -> CurrentUser:
    """Extract authenticated user context from request headers."""
    if not x_user_role:
        role = UserRole.ANALYST
    else:
        try:
            role = UserRole(x_user_role)
        except ValueError as err:
            valid_roles = [r.value for r in UserRole]
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Invalid user role: {x_user_role}. Must be one of {valid_roles}",
            ) from err

    return CurrentUser(
        user_id=x_user_id or "anonymous",
        username=x_username or "Farhan Aaqil",
        role=role,
    )


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


def record_audit_event(
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    details: dict[str, Any] | None = None,
) -> AuditEvent:
    """Record an immutable audit log entry."""
    event = AuditEvent(
        event_id=str(uuid4()),
        timestamp=datetime.now(UTC).isoformat(),
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
    )
    AUDIT_TRAIL.append(event)
    logger.info("AUDIT_EVENT: %s", json.dumps(event.model_dump()))
    return event


async def audit_logging_middleware(request: Request, call_next: Callable) -> Any:
    """Middleware attaching correlation ID and logging incoming requests."""
    correlation_id = request.headers.get("X-Correlation-Id", str(uuid4()))
    request.state.correlation_id = correlation_id

    response = await call_next(request)
    response.headers["X-Correlation-Id"] = correlation_id
    return response
