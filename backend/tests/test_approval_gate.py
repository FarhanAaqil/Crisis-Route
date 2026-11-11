"""Approval gate rules: submission, four-eyes, one-shot decisions, stale plans and export."""

import pytest

from app.api.scenarios import OBSERVATION_STORE
from app.domain.models import ObservationResponse, ObservationStatus, UserRole
from tests.helpers import auth_headers, make_client

client = make_client()
RATIONALE = "Reviewed corridor status with the district control room and found it acceptable."


@pytest.fixture
def plan():
    """A freshly optimized draft plan on the first seeded scenario, plus its scenario id."""
    sid = client.get("/api/v1/scenarios").json()[0]["scenario_id"]
    analyst = auth_headers(UserRole.ANALYST, "analyst-gate", "Gate Analyst")
    res = client.post(f"/api/v1/scenarios/{sid}/plans/optimize", headers=analyst)
    assert res.status_code == 201
    yield sid, res.json(), analyst
    OBSERVATION_STORE._items.pop(sid, None)


def _approve(plan_id, approver, decision="APPROVE", rationale=RATIONALE):
    return client.post(
        f"/api/v1/scenarios/plans/{plan_id}/approval",
        json={"decision": decision, "rationale": rationale},
        headers=approver,
    )


def test_draft_plan_cannot_be_signed_off_before_submission(plan):
    _, data, _ = plan
    res = _approve(data["plan_id"], auth_headers(UserRole.APPROVER, "lead-1", "Lead One"))
    assert res.status_code == 409
    assert "submitted" in res.json()["detail"]


def test_generator_cannot_approve_their_own_plan(plan):
    _, data, analyst = plan
    client.post(f"/api/v1/scenarios/plans/{data['plan_id']}/submit", headers=analyst)
    # An admin who generated the plan is still blocked by the four-eyes rule
    admin = auth_headers(UserRole.ADMIN, "analyst-gate", "Gate Analyst")
    res = _approve(data["plan_id"], admin)
    assert res.status_code == 409
    assert "four-eyes" in res.json()["detail"]


def test_decision_is_final_and_validated(plan):
    _, data, analyst = plan
    pid = data["plan_id"]
    client.post(f"/api/v1/scenarios/plans/{pid}/submit", headers=analyst)
    lead = auth_headers(UserRole.APPROVER, "lead-2", "Lead Two")

    assert _approve(pid, lead, decision="MAYBE").status_code == 422
    assert _approve(pid, lead, rationale="too short").status_code == 422

    ok = _approve(pid, lead, decision="reject")  # case-insensitive
    assert ok.status_code == 200
    assert ok.json()["approval_state"]["status"] == "REJECTED"
    assert ok.json()["approval_state"]["reviewed_at"] is not None

    again = _approve(pid, lead)
    assert again.status_code == 409


def test_new_field_report_makes_the_plan_stale_for_approval(plan):
    sid, data, analyst = plan
    pid = data["plan_id"]
    client.post(f"/api/v1/scenarios/plans/{pid}/submit", headers=analyst)

    edge_id = client.get(f"/api/v1/scenarios/{sid}/passability").json()["edges"][0]["edge_id"]
    OBSERVATION_STORE.append(
        sid, ObservationResponse(edge_id=edge_id, status=ObservationStatus.IMPASSABLE)
    )
    lead = auth_headers(UserRole.APPROVER, "lead-3", "Lead Three")
    res = _approve(pid, lead)
    assert res.status_code == 409
    assert "Re-optimize" in res.json()["detail"]
    # Rejecting a stale plan is still allowed
    assert _approve(pid, lead, decision="REJECT").status_code == 200


def test_only_approved_plans_are_flagged_deployable(plan):
    sid, data, analyst = plan
    pid = data["plan_id"]
    path = f"/api/v1/scenarios/{sid}/plans/{pid}/export"
    assert client.get(path).json()["deployable"] is False

    client.post(f"/api/v1/scenarios/plans/{pid}/submit", headers=analyst)
    assert _approve(pid, auth_headers(UserRole.APPROVER, "lead-4", "Lead Four")).status_code == 200
    exported = client.get(path).json()
    assert exported["deployable"] is True
    assert "does not certify route safety" in exported["notice"]


def test_submitting_twice_is_rejected(plan):
    _, data, analyst = plan
    pid = data["plan_id"]
    assert client.post(f"/api/v1/scenarios/plans/{pid}/submit", headers=analyst).status_code == 200
    assert client.post(f"/api/v1/scenarios/plans/{pid}/submit", headers=analyst).status_code == 409


def test_mock_plan_endpoint_is_gone(plan):
    sid, _, analyst = plan
    res = client.post(f"/api/v1/scenarios/{sid}/plans", headers=analyst)
    assert res.status_code in (404, 405)
