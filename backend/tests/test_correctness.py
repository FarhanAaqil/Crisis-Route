"""Regression tests for the equity groups, observation fusion, trips, EVPI and fan fixes."""

from datetime import UTC, datetime, timedelta

import networkx as nx
import pytest

from app.api.scenarios import build_benchmark_scenarios
from app.domain.groups import get_vulnerability_weight, is_protected_group
from app.domain.models import ObservationResponse, ObservationStatus, UserRole
from app.domain.observations import ObservationGraphManager
from app.graph.build import build_scenario_corridor_graph
from app.optimization.evaluation import evaluate_plan_under_samples
from app.optimization.floors import required_floor_units
from app.optimization.model import solve_equitable_allocation
from app.optimization.scenarios_sampler import sample_hazard_scenarios
from app.optimization.voi import evaluate_path_edge_evpi, rank_reconnaissance_corridors
from tests.helpers import make_client


def test_seeded_groups_are_recognised_as_protected_or_general():
    assert not is_protected_group("general_evacuees")
    assert not is_protected_group("General_Population")
    for group in ("tribal_hamlet", "elderly_cluster", "high_altitude_remote", "children_hospital"):
        assert is_protected_group(group), group
        assert get_vulnerability_weight(group) > 1.0
    assert get_vulnerability_weight("something_unknown") == 1.0


def test_floor_is_enforced_per_commodity_and_skips_general_nodes():
    scenario = build_benchmark_scenarios()[0]
    floors = required_floor_units(scenario)
    general = {n.id for n in scenario.demand_nodes if not is_protected_group(n.vulnerable_group)}
    assert general, "Kerala scenario should contain a general-population node"
    assert not any(node in general for node, _ in floors)

    plan, _ = solve_equitable_allocation(scenario, build_scenario_corridor_graph(scenario))
    assert plan is not None
    delivered: dict[tuple[str, str], int] = {}
    for item in plan.allocations:
        key = (item.demand_node_id, item.commodity_id)
        delivered[key] = delivered.get(key, 0) + item.quantity_delivered
    for key, target in floors.items():
        assert delivered.get(key, 0) >= target, f"floor missed for {key}"
    assert plan.equity_evaluation["alpha_floor_satisfied"] is True


def test_multi_stop_vehicles_keep_every_trip_in_the_plan():
    scenario = build_benchmark_scenarios()[0]
    plan, _ = solve_equitable_allocation(scenario, build_scenario_corridor_graph(scenario))
    assert plan is not None
    trips = {(r.vehicle_id, r.destination_node_id) for r in plan.vehicle_routes}
    served = {(a.vehicle_id, a.demand_node_id) for a in plan.allocations}
    assert served == trips
    assert all(r.payload_kg and r.depot_id for r in plan.vehicle_routes)


def _obs(edge_id, status, cred=0.9, hours_ago=0.0):
    return ObservationResponse(
        edge_id=edge_id,
        status=status,
        source_credibility=cred,
        timestamp=datetime.now(UTC) - timedelta(hours=hours_ago),
    )


def _two_edge_graph():
    g = nx.DiGraph()
    g.add_edge("a", "b", edge_id="E1", passability_prob=0.9, free_flow_sec=60.0)
    g.add_edge("b", "c", edge_id="E2", passability_prob=0.9, free_flow_sec=60.0)
    return g


def test_conflicts_are_detected_per_edge_not_across_the_network():
    open_e1 = _obs("E1", ObservationStatus.PASSABLE)
    blocked_e2 = _obs("E2", ObservationStatus.IMPASSABLE)
    assert not ObservationGraphManager.detect_conflicts([open_e1, blocked_e2])
    assert ObservationGraphManager.detect_conflicts(
        [open_e1, _obs("E1", ObservationStatus.IMPASSABLE)]
    )


def test_observation_order_does_not_change_the_result():
    reports = [
        _obs("E1", ObservationStatus.IMPASSABLE, 0.9, hours_ago=1.0),
        _obs("E1", ObservationStatus.PARTIALLY_BLOCKED, 0.6, hours_ago=0.2),
    ]
    now = datetime.now(UTC)
    g1, _, _ = ObservationGraphManager.apply_observations(_two_edge_graph(), reports, now)
    g2, _, _ = ObservationGraphManager.apply_observations(
        _two_edge_graph(), list(reversed(reports)), now
    )
    assert g1["a"]["b"]["passability_prob"] == g2["a"]["b"]["passability_prob"]
    assert g1["a"]["b"]["passability_prob"] < 0.5
    assert g1["b"]["c"]["passability_prob"] == 0.9  # untouched edge


def test_low_credibility_block_is_weaker_than_high_credibility_block():
    weak, _, _ = ObservationGraphManager.apply_observations(
        _two_edge_graph(), [_obs("E1", ObservationStatus.IMPASSABLE, 0.2)]
    )
    strong, _, _ = ObservationGraphManager.apply_observations(
        _two_edge_graph(), [_obs("E1", ObservationStatus.IMPASSABLE, 0.95)]
    )
    assert strong["a"]["b"]["passability_prob"] < weak["a"]["b"]["passability_prob"] < 0.9


def test_old_reports_fade_and_staleness_tracks_the_latest_report():
    g, _, _ = ObservationGraphManager.apply_observations(
        _two_edge_graph(), [_obs("E1", ObservationStatus.IMPASSABLE, 0.9, hours_ago=48)]
    )
    assert g["a"]["b"]["passability_prob"] > 0.85  # two days old: barely moves the estimate
    assert g["a"]["b"]["stale_age_hours"] == pytest.approx(48, abs=0.1)


def test_conflicting_reports_pull_towards_uncertainty():
    g, _, conflicted = ObservationGraphManager.apply_observations(
        _two_edge_graph(),
        [_obs("E1", ObservationStatus.IMPASSABLE), _obs("E1", ObservationStatus.PASSABLE)],
    )
    assert conflicted == {"E1"}
    assert 0.3 < g["a"]["b"]["passability_prob"] < 0.7


def _route_graph(p_edge: float, with_detour: bool):
    g = nx.DiGraph()
    g.add_edge("o", "m", edge_id="E1", passability_prob=0.99, free_flow_sec=600.0)
    g.add_edge("m", "d", edge_id="E2", passability_prob=p_edge, free_flow_sec=600.0)
    if with_detour:
        g.add_edge("o", "d", edge_id="DET", passability_prob=0.99, free_flow_sec=2400.0)
    return g


def test_evpi_is_zero_when_the_edge_is_certain_and_peaks_when_uncertain():
    path = ["E1", "E2"]
    values = {
        p: evaluate_path_edge_evpi(_route_graph(p, True), path, "E2").evpi_min
        for p in (0.01, 0.3, 0.5, 0.7, 0.99)
    }
    assert values[0.01] < 0.5 and values[0.99] < 0.5  # near-certain edges are worth ~nothing
    assert values[0.5] > 10 * max(values[0.01], values[0.99])
    assert max(values, key=values.get) in (0.3, 0.5, 0.7)


def test_evpi_ignores_the_first_edge_and_uses_a_penalty_without_detour():
    path = ["E1", "E2"]
    first = evaluate_path_edge_evpi(_route_graph(0.5, True), path, "E1")
    assert first.minutes_before_edge == 0.0
    cut = evaluate_path_edge_evpi(_route_graph(0.5, False), path, "E2")
    assert cut.detour_exists is False and cut.detour_minutes == 240.0


def test_recon_ranking_prefers_uncertain_links_on_busy_routes():
    g = _route_graph(0.5, True)
    ranked = rank_reconnaissance_corridors(g, [["E1", "E2"], ["E1", "E2"]], top_k=2)
    assert ranked[0].edge_id == "E2"
    assert ranked[0].voi_score >= ranked[1].voi_score


def test_plan_risk_is_scored_on_sampled_worlds():
    scenario = build_benchmark_scenarios()[0]
    g = build_scenario_corridor_graph(scenario)
    plan, _ = solve_equitable_allocation(scenario, g)
    bundle = sample_hazard_scenarios(g, num_samples=40, random_seed=1)
    profile = evaluate_plan_under_samples(scenario, plan, bundle)
    assert len(profile.losses) == 40
    assert profile.expected_shortfall(0.05) >= profile.expected_loss >= 0.0


def test_scenario_fan_reports_computed_losses_not_constants():
    client = make_client(UserRole.ANALYST)
    sid = client.get("/api/v1/scenarios").json()[0]["scenario_id"]
    fan = client.get(f"/api/v1/scenarios/{sid}/scenario-fan?num_samples=30").json()
    assert (fan["deterministic_loss"], fan["recourse_loss"], fan["expected_shortfall_95"]) != (
        42.5,
        18.2,
        28.4,
    )
    assert fan["expected_shortfall_95"] >= fan["recourse_loss"] >= 0.0


def test_calibration_metrics_come_from_the_report_file():
    client = make_client(UserRole.ANALYST)
    sid = client.get("/api/v1/scenarios").json()[0]["scenario_id"]
    data = client.get(f"/api/v1/scenarios/{sid}/passability").json()
    cal = data["calibration_metrics"]
    assert cal is not None and cal["total_samples"] > 0
    assert data["graph_source"] == "synthetic_corridor"
