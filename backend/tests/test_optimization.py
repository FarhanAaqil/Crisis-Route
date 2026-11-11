"""Unit and integration tests for CP-SAT equitable allocation and diagnostic explanation."""

from app.api.scenarios import seed_canonical_scenario
from app.domain.models import DemandNodeModel, ScenarioDetail
from app.graph.build import build_scenario_corridor_graph
from app.optimization.baseline import solve_proportional_baseline
from app.optimization.diagnostics import diagnose_scenario_feasibility
from app.optimization.model import solve_equitable_allocation
from tests.helpers import auth_headers, make_client


def _create_5_demand_scenario() -> ScenarioDetail:
    """Create test scenario with 2 depots and 5 demand nodes satisfying Exit Criterion 1."""
    scenario = seed_canonical_scenario().model_copy(deep=True)
    # Ensure there are at least 5 demand nodes and 2 depots
    assert len(scenario.depots) >= 2
    if len(scenario.demand_nodes) < 5:
        extra_node = DemandNodeModel(
            id="NODE-WAYANAD-ORPHANAGE",
            name="Wayanad Child Welfare Refuge",
            vulnerable_group="pediatric_refuge",
            population=150,
            coordinates=[76.10, 11.65],
            demand={
                "COM-WATER-10L": 80,
                "COM-MRE-RATIONS": 150,
                "COM-MED-TRAUMA": 40,
                "COM-SHELTER-TARPS": 30,
            },
        )
        scenario.demand_nodes.append(extra_node)
    assert len(scenario.demand_nodes) >= 5
    return scenario


def test_equitable_allocation_exit_criterion_1():
    """Verify scenario with >= 5 demand points and >= 2 depots solves to an allocation plan."""
    scenario = _create_5_demand_scenario()
    g = build_scenario_corridor_graph(scenario)

    plan, diag = solve_equitable_allocation(scenario, g)
    assert diag is None
    assert plan is not None
    assert plan.solver_status in ["OPTIMAL", "FEASIBLE", "NON_OPTIMAL_INCUMBENT"]
    assert len(plan.allocations) > 0
    assert len(plan.vehicle_routes) > 0
    assert plan.equity_evaluation["alpha_floor_satisfied"] is True
    assert 0.0 <= plan.equity_evaluation["gini_coefficient"] <= 1.0


def test_infeasible_inputs_exit_criterion_2():
    """Verify infeasible inputs (demand exceeds stock) return clear explanation without crashing."""
    scenario = _create_5_demand_scenario()
    # Artificially blow up water demand to 99,999 units
    scenario.demand_nodes[0].demand["COM-WATER-10L"] = 99999
    g = build_scenario_corridor_graph(scenario)

    plan, diag = solve_equitable_allocation(scenario, g)
    assert plan is None
    assert diag is not None
    assert diag["status"] == "INFEASIBLE"
    assert "COM-WATER-10L" in diag["commodity_deficits"]
    assert "exceeds total stock" in diag["detail"]
    assert len(diag["remediation_suggestions"]) > 0


def test_isolated_node_diagnostic():
    """Verify that an isolated demand node is diagnosed with actionable explanation."""
    scenario = _create_5_demand_scenario()
    g = build_scenario_corridor_graph(scenario)

    # Disconnect a demand node completely
    isolated_id = scenario.demand_nodes[0].id
    g.remove_edges_from(list(g.in_edges(isolated_id)))
    g.remove_edges_from(list(g.out_edges(isolated_id)))

    diagnostic = diagnose_scenario_feasibility(scenario, g)
    assert diagnostic.is_feasible is False
    assert isolated_id in diagnostic.isolated_demand_nodes
    assert any("physically unreachable" in exp for exp in diagnostic.explanations)


def test_baseline_proportional_allocation():
    """Verify proportional greedy baseline executes and generates comparable outputs."""
    scenario = _create_5_demand_scenario()
    g = build_scenario_corridor_graph(scenario)

    res = solve_proportional_baseline(scenario, g)
    assert len(res["allocations"]) > 0
    assert len(res["vehicle_routes"]) > 0
    assert res["equity"].mean_fulfillment_ratio > 0.0


def test_api_optimize_endpoint_and_export():
    """Test full HTTP API lifecycle for plan optimization and manifest export."""
    scenario = _create_5_demand_scenario()
    sid = str(scenario.scenario_id)

    client = make_client()
    headers = auth_headers("analyst", "analyst-001")

    # 1. Run optimization
    opt_res = client.post(f"/api/v1/scenarios/{sid}/plans/optimize?mode=robust", headers=headers)
    assert opt_res.status_code == 201
    plan_data = opt_res.json()
    assert plan_data["solver_status"] in ["OPTIMAL", "FEASIBLE"]
    plan_id = plan_data["plan_id"]

    # 2. Get active plan
    active_res = client.get(f"/api/v1/scenarios/{sid}/plans/active", headers=headers)
    assert active_res.status_code == 200
    assert active_res.json()["plan_id"] == plan_id

    # 3. Export plan manifest
    export_res = client.get(f"/api/v1/scenarios/{sid}/plans/{plan_id}/export", headers=headers)
    assert export_res.status_code == 200
    export_data = export_res.json()
    assert export_data["export_format"] == "CrisisRoute-Plan-v1"
    assert "allocations" in export_data
    assert "vehicle_routes" in export_data
