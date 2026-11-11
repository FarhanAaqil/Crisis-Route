"""Audit trail query endpoints for regulatory compliance and operational accountability."""

from fastapi import APIRouter, Depends, Query

from app.domain.audit import AuditEvent
from app.domain.models import UserRole
from app.persistence.audit_ledger import LEDGER
from app.security.auth import (
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
    events = list(reversed(LEDGER.events()))

    if action:
        events = [e for e in events if e.action.upper() == action.upper()]
    if resource_type:
        events = [e for e in events if e.resource_type.lower() == resource_type.lower()]
    if user_id:
        events = [e for e in events if e.user_id == user_id]

    return events[:limit]


@router.get("/verify")
def verify_audit_chain(
    current_user: CurrentUser = Depends(require_role([UserRole.APPROVER, UserRole.ADMIN])),
) -> dict[str, object]:
    """Recompute the hash chain and report whether the ledger is intact."""
    events = LEDGER.events()
    return {
        "intact": LEDGER.verify(),
        "event_count": len(events),
        "head_hash": events[-1].event_hash if events else None,
    }
