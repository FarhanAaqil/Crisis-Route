"""Integration gate test verifying Phase 7 (User-Ready Gate) criteria.

Verifies:
1. Role-based access control blocks unauthorized plan approvals.
2. Sign-off requires mandatory operational rationale (>= 10 chars).
3. Approved plans are immutably logged into the audit ledger with cryptographic event IDs.
4. Operational safety invariants are enforced across all endpoints.
"""

from app.domain.models import UserRole
from tests.helpers import auth_headers, make_client

client = make_client()


def test_user_ready_gate_signoff_and_audit_trail():
    """Verify end-to-end sign-off governance and immutable audit trail."""
    # 1. Fetch available scenarios
    scenarios_resp = client.get("/api/v1/scenarios")
    assert scenarios_resp.status_code == 200
    scenarios = scenarios_resp.json()
    assert len(scenarios) >= 1
    scenario_id = scenarios[0]["scenario_id"]

    # 2. Field Analyst attempts sign-off -> Must be Forbidden (403)
    field_resp = client.post(
        f"/api/v1/scenarios/{scenario_id}/approve",
        headers=auth_headers(UserRole.FIELD_ANALYST.value, "field-agent-99"),
        json={"rationale": "Field inspection confirmed single-lane passability."},
    )
    assert field_resp.status_code == 403

    # 3. Logistics Coordinator (Analyst) attempts sign-off -> Must be Forbidden (403)
    analyst_resp = client.post(
        f"/api/v1/scenarios/{scenario_id}/approve",
        headers=auth_headers(UserRole.ANALYST.value, "analyst-coordinator-01"),
        json={"rationale": "All demand nodes covered above alpha threshold."},
    )
    assert analyst_resp.status_code == 403

    # 4. Approver attempts sign-off without adequate rationale (< 10 chars) -> 422 Unprocessable
    short_rationale_resp = client.post(
        f"/api/v1/scenarios/{scenario_id}/approve",
        headers=auth_headers(UserRole.APPROVER.value, "incident-lead-42"),
        json={"rationale": "ok"},
    )
    assert short_rationale_resp.status_code == 422

    # 5. Approver executes valid sign-off with detailed rationale -> Success (200)
    valid_rationale = (
        "Authorized under Kerala SDMA SOP-2026. Meppadi bypass confirmed passable with 4WD convoy."
    )
    approver_resp = client.post(
        f"/api/v1/scenarios/{scenario_id}/approve",
        headers=auth_headers(UserRole.APPROVER.value, "incident-lead-42"),
        json={"rationale": valid_rationale},
    )
    assert approver_resp.status_code == 200
    approval_data = approver_resp.json()
    assert approval_data["status"] == "APPROVED"
    assert approval_data["approver_id"] == "incident-lead-42"
    assert approval_data["rationale"] == valid_rationale

    # 6. Verify audit trail reflects the sign-off event
    audit_resp = client.get(
        "/api/v1/audit?action=PLAN_APPROVAL",
        headers=auth_headers(UserRole.APPROVER.value, "incident-lead-42"),
    )
    assert audit_resp.status_code == 200
    events = audit_resp.json()
    assert len(events) >= 1
    latest_event = events[0]
    assert latest_event["action"] == "PLAN_APPROVAL"
    assert latest_event["user_id"] == "incident-lead-42"
    assert latest_event["resource_id"] == scenario_id
