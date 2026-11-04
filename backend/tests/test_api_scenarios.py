"""Integration tests for FastAPI endpoints and mock vertical slice."""

from fastapi.testclient import TestClient

from app.domain.models import UserRole
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    """Verify system health endpoint returns operational status."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["graph_engine"] == "NetworkX-2.0"
    assert data["solver_engine"] == "OR-Tools CP-SAT v9.10"


def test_list_scenarios_returns_seeded_scenario():
    """Verify seeded Kerala monsoon scenario is listed."""
    response = client.get("/api/v1/scenarios")
    assert response.status_code == 200
    scenarios = response.json()
    assert len(scenarios) >= 1
    assert any("Kerala" in s["name"] for s in scenarios)


def test_get_scenario_detail():
    """Verify detail endpoint returns complete scenario structure."""
    list_resp = client.get("/api/v1/scenarios")
    scenario_id = list_resp.json()[0]["scenario_id"]

    detail_resp = client.get(f"/api/v1/scenarios/{scenario_id}")
    assert detail_resp.status_code == 200
    data = detail_resp.json()
    assert data["scenario_id"] == scenario_id
    assert len(data["commodities"]) >= 1
    assert len(data["depots"]) >= 1
    assert len(data["vehicles"]) >= 1
    assert len(data["demand_nodes"]) >= 1


def test_submit_observation():
    """Verify field observation submission and audit logging."""
    list_resp = client.get("/api/v1/scenarios")
    scenario_id = list_resp.json()[0]["scenario_id"]

    payload = {
        "edge_id": "EDGE-WAYANAD-NH766-01",
        "status": "partially_blocked",
        "source_type": "field_patrol",
        "source_credibility": 0.85,
        "confidence_interval": [0.3, 0.6],
        "water_depth_cm": 25.0,
        "reported_by": "kerala_disaster_patrol_04",
        "notes": "Debris clearance in progress by local rescue teams",
    }

    headers = {
        "X-User-Id": "field-analyst-02",
        "X-User-Role": UserRole.FIELD_ANALYST.value,
        "X-Username": "Field Officer Rajesh",
    }

    post_resp = client.post(
        f"/api/v1/scenarios/{scenario_id}/observations",
        json=payload,
        headers=headers,
    )
    assert post_resp.status_code == 201
    obs_data = post_resp.json()
    assert obs_data["edge_id"] == payload["edge_id"]
    assert obs_data["status"] == "partially_blocked"


def test_mock_vertical_slice_generation_and_approval():
    """Verify the Phase 1 end-to-end slice: generate plan and execute approval."""
    list_resp = client.get("/api/v1/scenarios")
    scenario_id = list_resp.json()[0]["scenario_id"]

    # 1. Analyst generates mock plan
    gen_headers = {
        "X-User-Id": "analyst-farhan",
        "X-User-Role": UserRole.ANALYST.value,
        "X-Username": "Farhan Aaqil",
    }
    plan_resp = client.post(f"/api/v1/scenarios/{scenario_id}/plans", headers=gen_headers)
    assert plan_resp.status_code == 200
    plan = plan_resp.json()
    assert plan["solver_status"] == "FEASIBLE"
    assert len(plan["vehicle_routes"]) >= 1
    assert len(plan["allocations"]) >= 1
    assert plan["approval_state"]["status"] == "PENDING_APPROVAL"

    plan_id = plan["plan_id"]

    # 2. Unauthorized role attempting approval is rejected (403)
    unauth_headers = {
        "X-User-Id": "analyst-farhan",
        "X-User-Role": UserRole.ANALYST.value,
        "X-Username": "Farhan Aaqil",
    }
    fail_approve = client.post(
        f"/api/v1/scenarios/plans/{plan_id}/approval",
        json={"decision": "APPROVE", "rationale": "Attempting sign-off without approver role"},
        headers=unauth_headers,
    )
    assert fail_approve.status_code == 403

    # 3. Incident Lead Approver approves with mandatory rationale
    approver_headers = {
        "X-User-Id": "lead-approver-01",
        "X-User-Role": UserRole.APPROVER.value,
        "X-Username": "Incident Commander Nair",
    }
    rationale_text = (
        "High priority water deliveries verified via alternate SH54 route with secondary escort."
    )
    approve_resp = client.post(
        f"/api/v1/scenarios/plans/{plan_id}/approval",
        json={
            "decision": "APPROVE",
            "rationale": rationale_text,
        },
        headers=approver_headers,
    )
    assert approve_resp.status_code == 200
    approved_plan = approve_resp.json()
    assert approved_plan["approval_state"]["status"] == "APPROVED"
    assert approved_plan["approval_state"]["reviewed_by"] == "Incident Commander Nair"
