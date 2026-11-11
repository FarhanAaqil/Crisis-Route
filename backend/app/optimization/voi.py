"""Value of Information (VoI) prioritization engine for road reconnaissance."""

from dataclasses import dataclass
from typing import Any

import networkx as nx

from app.domain.models import ReconnaissanceRecommendation


@dataclass
class EdgeVoIProfile:
    """Detailed Value-of-Information evaluation for a candidate inspection link."""

    edge_id: str
    passability_prob: float
    uncertainty_entropy: float
    traffic_exposure_frequency: int
    expected_regret_reduction_min: float
    inspection_cost: float
    voi_score: float
    priority_rank: int


def calculate_binary_entropy(p: float) -> float:
    """Compute Shannon entropy for a binary hazard state: H(p) = -p log2 p - (1-p) log2 (1-p)."""
    safe_p = max(0.001, min(0.999, p))
    import math

    return -(safe_p * math.log2(safe_p) + (1.0 - safe_p) * math.log2(1.0 - safe_p))


def compute_edge_traffic_exposure(
    g: nx.DiGraph,
    active_paths: list[list[str]],
) -> dict[str, int]:
    """Count how many planned delivery routes traverse each road edge."""
    exposure: dict[str, int] = {}
    for path in active_paths:
        for eid in path:
            exposure[eid] = exposure.get(eid, 0) + 1
    return exposure


def evaluate_edge_voi(
    g: nx.DiGraph,
    edge_id: str,
    traffic_exposure: int = 1,
    inspection_cost: float = 10.0,
    time_penalty_if_blocked_min: float = 25.0,
) -> EdgeVoIProfile:
    """Cheap variance-based VoI proxy for an edge (no route context needed).

    Expected Regret Reduction = exposure * p * (1 - p) * penalty. This is a screening heuristic,
    not an EVPI: see ``evaluate_path_edge_evpi`` for the decision-theoretic value used to rank
    reconnaissance targets.
    """
    # Find edge in graph
    target_data: dict[str, Any] | None = None
    for _u, _v, d in g.edges(data=True):
        if str(d.get("edge_id")) == edge_id:
            target_data = d
            break

    if target_data is None:
        p = 0.5
    else:
        p = float(target_data.get("passability_prob", 0.5))

    entropy = calculate_binary_entropy(p)

    # Uncertainty variance: p * (1 - p) peaks at p=0.5
    uncertainty_var = p * (1.0 - p)

    # Expected regret reduction in minutes if uncertainty is resolved before dispatch
    regret_reduction = float(traffic_exposure * uncertainty_var * time_penalty_if_blocked_min)

    # VoI score: benefit per dollar of reconnaissance inspection
    voi = round(regret_reduction / max(1.0, inspection_cost), 4)

    return EdgeVoIProfile(
        edge_id=edge_id,
        passability_prob=round(p, 4),
        uncertainty_entropy=round(entropy, 4),
        traffic_exposure_frequency=traffic_exposure,
        expected_regret_reduction_min=round(regret_reduction, 2),
        inspection_cost=inspection_cost,
        voi_score=voi,
        priority_rank=1,
    )


def _edge_index(g: nx.DiGraph) -> dict[str, tuple[str, str, dict[str, Any]]]:
    return {str(d.get("edge_id")): (u, v, d) for u, v, d in g.edges(data=True)}


@dataclass
class EdgeEvpi:
    """Expected value of perfect information about one road link for one planned route."""

    edge_id: str
    passability_prob: float
    minutes_before_edge: float
    route_minutes: float
    detour_minutes: float
    detour_exists: bool
    cost_without_info_min: float
    cost_with_info_min: float

    @property
    def evpi_min(self) -> float:
        return max(0.0, self.cost_without_info_min - self.cost_with_info_min)


def evaluate_path_edge_evpi(
    g: nx.DiGraph,
    path_edge_ids: list[str],
    edge_id: str,
    no_route_penalty_min: float = 240.0,
    index: dict[str, tuple[str, str, dict[str, Any]]] | None = None,
) -> EdgeEvpi | None:
    """Exact EVPI for the decision "drive this route, or take the best detour around the edge".

    A convoy that commits to the route only discovers a blocked link on arrival, so it loses the
    time already driven twice (there and back) before taking the detour:

        without information:  min( p*T_route + (1-p)*(2*T_before + T_detour),  T_detour )
        with information:     p*min(T_route, T_detour) + (1-p)*T_detour

    The difference is the expected minutes a drone or patrol report would save. When no detour
    exists, T_detour is ``no_route_penalty_min`` (the cost of holding the convoy back).
    """
    index = index if index is not None else _edge_index(g)
    if edge_id not in path_edge_ids or any(eid not in index for eid in path_edge_ids):
        return None

    pos = path_edge_ids.index(edge_id)
    times = [float(index[eid][2].get("free_flow_sec", 60.0)) / 60.0 for eid in path_edge_ids]
    t_before = sum(times[:pos])
    t_route = sum(times)
    origin = index[path_edge_ids[0]][0]
    target = index[path_edge_ids[-1]][1]
    p = max(0.0, min(1.0, float(index[edge_id][2].get("passability_prob", 0.5))))

    def weight(_u: str, _v: str, data: dict[str, Any]) -> float | None:
        if str(data.get("edge_id")) == edge_id:
            return None  # hide the edge under inspection
        return float(data.get("free_flow_sec", 60.0))

    try:
        t_detour = float(nx.dijkstra_path_length(g, origin, target, weight=weight)) / 60.0
        detour_exists = True
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        t_detour = no_route_penalty_min
        detour_exists = False

    expected_commit = p * t_route + (1.0 - p) * (2.0 * t_before + t_detour)
    without_info = min(expected_commit, t_detour)
    with_info = p * min(t_route, t_detour) + (1.0 - p) * t_detour
    return EdgeEvpi(
        edge_id=edge_id,
        passability_prob=p,
        minutes_before_edge=t_before,
        route_minutes=t_route,
        detour_minutes=t_detour,
        detour_exists=detour_exists,
        cost_without_info_min=without_info,
        cost_with_info_min=with_info,
    )


def rank_reconnaissance_corridors(
    g: nx.DiGraph,
    active_paths: list[list[str]],
    candidate_edges: list[str] | None = None,
    top_k: int = 5,
    inspection_cost: float = 10.0,
) -> list[ReconnaissanceRecommendation]:
    """Rank road edges on the planned routes by expected value of perfect information.

    Each route is evaluated separately and the minutes saved are summed over every route that
    crosses the edge, so busy corridors with uncertain links rise to the top.
    """
    exposure_map = compute_edge_traffic_exposure(g, active_paths)
    if candidate_edges is None:
        candidate_edges = list(exposure_map.keys())

    index = _edge_index(g)
    totals: dict[str, float] = {}
    for eid in candidate_edges:
        total = 0.0
        for path in active_paths:
            if eid in path:
                result = evaluate_path_edge_evpi(g, path, eid, index=index)
                if result is not None:
                    total += result.evpi_min
        totals[eid] = total

    profiles: list[EdgeVoIProfile] = []
    for eid, regret in totals.items():
        edge = index.get(eid)
        prob = float(edge[2].get("passability_prob", 0.5)) if edge else 0.5
        profiles.append(
            EdgeVoIProfile(
                edge_id=eid,
                passability_prob=round(prob, 4),
                uncertainty_entropy=round(calculate_binary_entropy(prob), 4),
                traffic_exposure_frequency=exposure_map.get(eid, 0),
                expected_regret_reduction_min=round(regret, 2),
                inspection_cost=inspection_cost,
                voi_score=round(regret / max(1.0, inspection_cost), 4),
                priority_rank=1,
            )
        )

    # Sort descending by VoI score
    profiles.sort(key=lambda p: p.voi_score, reverse=True)

    recommendations: list[ReconnaissanceRecommendation] = []
    for rank, p in enumerate(profiles[:top_k], 1):
        recommendations.append(
            ReconnaissanceRecommendation(
                edge_id=p.edge_id,
                expected_regret_reduction=p.expected_regret_reduction_min,
                inspection_cost=p.inspection_cost,
                voi_score=p.voi_score,
                priority_rank=rank,
            )
        )

    return recommendations
