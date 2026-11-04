"""Unit tests for Role-Based Access Control and audit logging."""

import pytest
from fastapi import HTTPException

from app.domain.models import UserRole
from app.security.auth import CurrentUser, record_audit_event, require_role


def test_require_role_success():
    """Verify authorized user passes role check."""
    checker = require_role([UserRole.APPROVER])
    approver_user = CurrentUser(user_id="user-1", username="Approver Lead", role=UserRole.APPROVER)
    assert checker(approver_user) == approver_user


def test_require_role_forbidden():
    """Verify unauthorized role raises 403 HTTP exception."""
    checker = require_role([UserRole.APPROVER])
    analyst_user = CurrentUser(user_id="user-2", username="Analyst Officer", role=UserRole.ANALYST)
    with pytest.raises(HTTPException) as exc_info:
        checker(analyst_user)
    assert exc_info.value.status_code == 403


def test_audit_event_recording():
    """Verify audit events are structured and persisted."""
    event = record_audit_event(
        user_id="test-user",
        action="TEST_ACTION",
        resource_type="scenario",
        resource_id="scen-001",
        details={"note": "audit check"},
    )
    assert event.user_id == "test-user"
    assert event.action == "TEST_ACTION"
    assert event.resource_id == "scen-001"
