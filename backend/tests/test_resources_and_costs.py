"""Unit tests for edge cost parameterization and scenario resource management."""

import networkx as nx
from fastapi.testclient import TestClient

from app.api.scenarios import seed_canonical_scenario
from app.graph.costs import (
    EdgeCostParameters,
    annotate_graph_costs,
    compute_edge_impedance,
    summarize_path,
    sweep_risk_sensitivity,
)
from app.main import app


def test_edge_impedance_monotonicity():
    """Verify that lower passability and higher staleness increase edge impedance."""
    base_cost = compute_edge_impedance(
        free_flow_sec=100.0, passability_prob=0.99, stale_age_hours=0.0
    )
    risky_cost = compute_edge_impedance(
        free_flow_sec=100.0, passability_prob=0.30, stale_age_hours=0.0
    )
    stale_cost = compute_edge_impedance(
        free_flow_sec=100.0, passability_prob=0.99, stale_age_hours=12.0
    )

    assert risky_cost > base_cost
    assert stale_cost > base_cost


def test_graph_cost_annotation_and_summary():
    """Verify in-place cost annotation and path summary extraction."""
    g = nx.DiGraph()
    g.add_edge(
        "N1", "N2", edge_id="E1", free_flow_sec=60.0, passability_prob=0.8, stale_age_hours=1.0
    )
    g.add_edge(
        "N2", "N3", edge_id="E2", free_flow_sec=40.0, passability_prob=0.5, stale_age_hours=0.0
    )

    annotate_graph_costs(g, EdgeCostParameters(lambda_r=50.0, lambda_s=2.0))

    assert "cost" in g["N1"]["N2"]
    assert "cost" in g["N2"]["N3"]

    summary = summarize_path(g, ["N1", "N2", "N3"])
    assert summary.travel_time_sec == 100.0
    assert summary.survival_probability == 0.40  # 0.8 * 0.5
    assert summary.bottleneck_edge_id == "E2"
    assert summary.bottleneck_passability == 0.50


def test_risk_sensitivity_sweep():
    """Verify risk sweep shifts routing from fast-but-risky to longer-but-reliable."""
    g = nx.DiGraph()
    # Path A: Fast (50s) but risky (p=0.40)
    g.add_edge("S", "T", edge_id="RISKY_DIRECT", free_flow_sec=50.0, passability_prob=0.40)

    # Path B: Detour (150s) but reliable (p=0.95)
    g.add_edge("S", "MID", edge_id="DETOUR_1", free_flow_sec=75.0, passability_prob=0.98)
    g.add_edge("MID", "T", edge_id="DETOUR_2", free_flow_sec=75.0, passability_prob=0.98)

    sweep = sweep_risk_sensitivity(g, "S", "T", lambda_values=[0.0, 200.0])

    # At lambda_r=0, shortest time path is taken (direct)
    assert sweep[0]["path"] == ["S", "T"]

    # At high lambda_r=200, safe detour is taken
    assert sweep[1]["path"] == ["S", "MID", "T"]
    assert sweep[1]["survival_probability"] > sweep[0]["survival_probability"]


def test_scenario_resource_endpoints():
    """Verify resource retrieval and update endpoints."""
    scenario = seed_canonical_scenario()
    sid = str(scenario.scenario_id)

    client = TestClient(app)
    headers = {"X-User-Role": "analyst", "X-User-Id": "analyst-001"}

    # 1. Get resources
    res = client.get(f"/api/v1/scenarios/{sid}/resources")
    assert res.status_code == 200
    data = res.json()
    assert "depots" in data
    assert "demand_nodes" in data
    assert "vehicles" in data
    assert "total_demand_by_commodity" in data

    # 2. Add a new demand node
    new_node = {
        "id": "NODE-TEST-FLOOD-SHELTER",
        "name": "Test Flood Shelter",
        "vulnerable_group": "elderly_clinic",
        "population": 250,
        "coordinates": [76.15, 11.60],
        "demand": {"COM-WATER-10L": 120, "COM-FOOD-PACK": 80},
    }
    post_res = client.post(
        f"/api/v1/scenarios/{sid}/resources/demand-nodes",
        json=new_node,
        headers=headers,
    )
    assert post_res.status_code == 201
    assert post_res.json()["id"] == "NODE-TEST-FLOOD-SHELTER"

    # Verify node in resource overview
    res_after = client.get(f"/api/v1/scenarios/{sid}/resources")
    assert res_after.json()["total_demand_by_commodity"]["COM-WATER-10L"] >= 120

    # 3. Delete the added demand node
    del_res = client.delete(
        f"/api/v1/scenarios/{sid}/resources/demand-nodes/NODE-TEST-FLOOD-SHELTER",
        headers=headers,
    )
    assert del_res.status_code == 204
