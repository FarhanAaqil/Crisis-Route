"""Audit trail query endpoints for regulatory compliance and operational accountability."""

from fastapi import APIRouter, Depends, Query

from app.domain.models import UserRole
from app.security.auth import (
    AUDIT_TRAIL,
    AuditEvent,
    CurrentUser,
    require_role,
)

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


@router.get("", response_model=list[AuditEvent])
def list_audit_events(
    action: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    current_user: CurrentUser = Depends(
        require_role([UserRole.ANALYST, UserRole.APPROVER, UserRole.ADMIN])
    ),
) -> list[AuditEvent]:
    """Retrieve filtered operational audit logs in reverse chronological order."""
    events = list(reversed(AUDIT_TRAIL))

    if action:
        events = [e for e in events if e.action.upper() == action.upper()]
    if resource_type:
        events = [e for e in events if e.resource_type.lower() == resource_type.lower()]
    if user_id:
        events = [e for e in events if e.user_id == user_id]

    return events[:limit]

