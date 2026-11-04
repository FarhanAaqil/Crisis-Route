"""Unit and integration tests for the audit trail endpoint."""

from fastapi.testclient import TestClient

from app.domain.models import UserRole
from app.main import app
from app.security.auth import record_audit_event

client = TestClient(app)


def test_audit_list_authorized_analyst():
    """Verify analyst can access the audit log trail."""
    record_audit_event(
        user_id="analyst-1",
        action="TEST_FILTER_ACTION",
        resource_type="scenario",
        resource_id="scen-test",
        details={"reason": "verification"},
    )

    response = client.get(
        "/api/v1/audit",
        headers={
            "X-User-Role": UserRole.ANALYST.value,
            "X-User-Id": "analyst-1",
        },
    )
    assert response.status_code == 200
    events = response.json()
    assert isinstance(events, list)
    assert any(e["action"] == "TEST_FILTER_ACTION" for e in events)


def test_audit_list_forbidden_field_analyst():
    """Verify field analyst role cannot view the audit ledger (403)."""
    response = client.get(
        "/api/v1/audit",
        headers={
            "X-User-Role": UserRole.FIELD_ANALYST.value,
            "X-User-Id": "field-1",
        },
    )
    assert response.status_code == 403


def test_audit_list_filtering():
    """Verify filtering by action and resource type."""
    record_audit_event(
        user_id="approver-lead",
        action="APPROVAL_SIGN_OFF",
        resource_type="plan",
        resource_id="plan-unique-99",
        details={"approved": True},
    )

    response = client.get(
        "/api/v1/audit?action=APPROVAL_SIGN_OFF&resource_type=plan",
        headers={
            "X-User-Role": UserRole.APPROVER.value,
            "X-User-Id": "approver-lead",
        },
    )
    assert response.status_code == 200
    events = response.json()
    assert len(events) >= 1
    assert all(e["action"] == "APPROVAL_SIGN_OFF" for e in events)
    assert all(e["resource_type"] == "plan" for e in events)

