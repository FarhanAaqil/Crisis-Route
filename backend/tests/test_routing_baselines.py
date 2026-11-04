"""Unit tests for routing baselines and comparative safety evaluation."""

import networkx as nx
from experiments.baselines_routing import (
    evaluate_routing_policies,
    route_hard_threshold,
    route_risk_aware,
    route_shortest_time,
)


def _build_test_corridor_graph() -> nx.DiGraph:
    """Construct a synthetic disaster corridor with a direct fragile road and a detour.

    S -> T: Direct, 40s travel time, but severely degraded (p=0.20), edge_id='E_DIRECT'.
    S -> B -> T: Detour, 80s travel time, high reliability (p=0.90 each).
    """
    g = nx.DiGraph()
    g.add_edge("S", "T", edge_id="E_DIRECT", free_flow_sec=40.0, passability_prob=0.20)
    g.add_edge("S", "B", edge_id="E_DETOUR_1", free_flow_sec=40.0, passability_prob=0.90)
    g.add_edge("B", "T", edge_id="E_DETOUR_2", free_flow_sec=40.0, passability_prob=0.90)
    return g


def test_shortest_time_policy_selects_risky_direct_edge():
    """Shortest time Dijkstra selects the direct fast road despite severe degradation."""
    g = _build_test_corridor_graph()
    res = route_shortest_time(g, "S", "T")

    assert res.is_connected is True
    assert res.path_nodes == ["S", "T"]
    assert res.travel_time_sec == 40.0
    assert res.survival_probability == 0.20


def test_hard_threshold_policy_filters_degraded_edges():
    """Hard threshold policy prunes edges below cutoff (0.35) and diverts to detour."""
    g = _build_test_corridor_graph()
    res = route_hard_threshold(g, "S", "T", passability_cutoff=0.35)

    assert res.is_connected is True
    assert res.path_nodes == ["S", "B", "T"]
    assert res.travel_time_sec == 80.0
    assert res.survival_probability == 0.81  # 0.9 * 0.9


def test_hard_threshold_policy_reports_disconnection_when_no_safe_path():
    """When all connecting links are below cutoff, hard threshold reports disconnected."""
    g = nx.DiGraph()
    g.add_edge("A", "B", edge_id="LOW_P", free_flow_sec=30.0, passability_prob=0.15)

    res = route_hard_threshold(g, "A", "B", passability_cutoff=0.35)
    assert res.is_connected is False
    assert res.path_nodes == []


def test_risk_aware_policy_balances_time_and_risk():
    """Risk-aware Dijkstra naturally detours around the fragile direct road."""
    g = _build_test_corridor_graph()
    res = route_risk_aware(g, "S", "T", lambda_r=60.0)

    assert res.is_connected is True
    assert res.path_nodes == ["S", "B", "T"]
    assert res.survival_probability > 0.80


def test_evaluate_routing_policies_comparison():
    """Comparative evaluation confirms risk-aware reduces severance under hazard ground truth."""
    g = _build_test_corridor_graph()
    # Assume ground truth hazard blocked the fragile direct road
    ground_truth = {"E_DIRECT"}

    comparison = evaluate_routing_policies(
        g,
        od_pairs=[("S", "T")],
        ground_truth_blocks=ground_truth,
    )

    assert "shortest_time" in comparison
    assert "hard_threshold_0.35" in comparison
    assert "risk_aware" in comparison

    # Shortest time took E_DIRECT which is severed
    assert comparison["shortest_time"]["severance_rate"] == 1.0
    # Hard threshold and risk aware diverted, so 0 severance
    assert comparison["hard_threshold_0.35"]["severance_rate"] == 0.0
    assert comparison["risk_aware"]["severance_rate"] == 0.0
    assert comparison["risk_aware"]["mean_survival_probability"] > 0.80
