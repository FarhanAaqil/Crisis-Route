"""Master submission-ready gate test verifying all 8 phase exit criteria for CrisisRoute."""

from pathlib import Path

from app.api.scenarios import SCENARIO_STORE
from app.domain.models import UserRole
from app.graph.build import build_scenario_corridor_graph
from app.graph.costs import compute_edge_impedance
from app.optimization.recourse import solve_two_stage_recourse
from tests.helpers import auth_headers, make_client

client = make_client()


def test_submission_gate_all_phases_verified():
    """Verify complete end-to-end criteria for all 8 development phases."""
    root_dir = Path(__file__).resolve().parent.parent.parent.parent

    # =========================================================================
    # Phase 1 Gate: Architecture & Contracts Ready
    # =========================================================================
    health_resp = client.get("/api/v1/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "HEALTHY"

    openapi_resp = client.get("/api/v1/openapi.json")
    assert openapi_resp.status_code == 200
    assert "paths" in openapi_resp.json()

    # =========================================================================
    # Phase 2 Gate: Ingestion & Data Ready
    # =========================================================================
    scenarios_resp = client.get("/api/v1/scenarios")
    assert scenarios_resp.status_code == 200
    scenarios = scenarios_resp.json()
    assert len(scenarios) >= 1
    assert any("Kerala" in s["name"] for s in scenarios)
    scenario_id = scenarios[0]["scenario_id"]

    # =========================================================================
    # Phase 3 Gate: Passability Calibration & Risk Routing Ready
    # =========================================================================
    # Verify edge cost impedance increases monotonically with risk and staleness
    c_safe = compute_edge_impedance(free_flow_sec=100.0, passability_prob=0.95, stale_age_hours=0.0)
    c_risky = compute_edge_impedance(
        free_flow_sec=100.0, passability_prob=0.30, stale_age_hours=0.0
    )
    assert c_risky > c_safe

    # Verify scenario resource inventory and fleet availability
    res_resp = client.get(f"/api/v1/scenarios/{scenario_id}/resources")
    assert res_resp.status_code == 200
    res_data = res_resp.json()
    assert len(res_data["depots"]) >= 1
    assert len(res_data["demand_nodes"]) >= 1
    assert res_data["total_fleet_capacity_kg"] > 0

    # =========================================================================
    # Phase 4 Gate: Multi-Commodity Allocation MVP Ready
    # =========================================================================
    alloc_resp = client.post(
        f"/api/v1/scenarios/{scenario_id}/plans/optimize",
        headers=auth_headers(UserRole.ANALYST.value, "analyst-lead"),
    )
    assert alloc_resp.status_code == 201
    alloc_data = alloc_resp.json()
    assert alloc_data["solver_status"] in ["OPTIMAL", "FEASIBLE"]
    assert alloc_data["equity_evaluation"]["alpha_floor_satisfied"] is True
    assert alloc_data["equity_evaluation"]["vulnerable_group_fulfillment_ratio"] >= 0.40
    assert alloc_data["equity_evaluation"]["gini_coefficient"] <= 0.20
    assert len(alloc_data["allocations"]) >= 1

    # =========================================================================
    # Phase 5 Gate: Stochastic Recourse & VoI Engine Ready
    # =========================================================================
    scenario_obj = SCENARIO_STORE[scenario_id].model_copy(deep=True)
    g = build_scenario_corridor_graph(scenario_obj)
    recourse_result = solve_two_stage_recourse(
        scenario_obj,
        g,
        num_samples=10,
        time_limit_sec=15.0,
        random_seed=42,
    )
    assert recourse_result.is_within_target_gap is True
    assert recourse_result.optimality_gap <= 0.05

    # =========================================================================
    # Phase 6 Gate: Empirical Evidence & Reproducibility Ready
    # =========================================================================
    reports_dir = root_dir / "reports"
    assert (reports_dir / "hypothesis_results.json").exists()
    assert (reports_dir / "stress_tests_results.json").exists()
    assert (reports_dir / "reproducibility_manifest.json").exists()
    assert (reports_dir / "empirical_study.md").exists()
    assert (reports_dir / "stress_tests.md").exists()

    # =========================================================================
    # Phase 7 Gate: UI Accessibility & Operational Walkthrough Ready
    # =========================================================================
    # Verify Incident Lead sign-off governance
    submit_resp = client.post(
        f"/api/v1/scenarios/plans/{alloc_data['plan_id']}/submit",
        headers=auth_headers(UserRole.ANALYST.value, "analyst-lead"),
    )
    assert submit_resp.status_code == 200
    signoff_resp = client.post(
        f"/api/v1/scenarios/{scenario_id}/approve",
        headers=auth_headers(UserRole.APPROVER.value, "incident-lead-final-signoff"),
        json={
            "decision": "APPROVE",
            "rationale": "Comprehensive Phase 8 submission gate verification and field sign-off.",
        },
    )
    assert signoff_resp.status_code == 200
    assert signoff_resp.json()["status"] == "APPROVED"

    # Verify audit ledger recorded the final sign-off
    audit_resp = client.get(
        "/api/v1/audit?action=PLAN_APPROVAL",
        headers=auth_headers(UserRole.APPROVER.value, "incident-lead-final-signoff"),
    )
    assert audit_resp.status_code == 200
    assert any(e["user_id"] == "incident-lead-final-signoff" for e in audit_resp.json())

    # =========================================================================
    # Phase 8 Gate: Packaging & Open-Source Distribution Ready
    # =========================================================================
    assert (root_dir / "LICENSE").exists()
    assert "Apache License" in (root_dir / "LICENSE").read_text(encoding="utf-8")
    assert (root_dir / "Dockerfile").exists()
    assert (root_dir / "docker-compose.yml").exists()
    assert (root_dir / "Makefile").exists()
    assert (root_dir / "CONTRIBUTING.md").exists()
    assert (root_dir / "README.md").exists()
    assert (root_dir / "reports" / "manuscript.md").exists()
    assert (root_dir / "docs" / "manuscript" / "main.tex").exists()
    assert (root_dir / "docs" / "manuscript" / "supplementary.md").exists()
