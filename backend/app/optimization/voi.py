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
    """Calculate the expected regret reduction and VoI score for inspecting an edge.

    VoI = (Traffic Exposure * Expected Regret Reduction) / Inspection Cost
    Expected Regret Reduction = p * (1 - p) * Detour/Reroute Cost Penalty
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


def rank_reconnaissance_corridors(
    g: nx.DiGraph,
    active_paths: list[list[str]],
    candidate_edges: list[str] | None = None,
    top_k: int = 5,
) -> list[ReconnaissanceRecommendation]:
    """Identify and rank the highest Value-of-Information road edges for field inspection."""
    exposure_map = compute_edge_traffic_exposure(g, active_paths)

    if candidate_edges is None:
        # Candidates are all edges used in active delivery plans
        candidate_edges = list(exposure_map.keys())

    profiles: list[EdgeVoIProfile] = []
    for eid in candidate_edges:
        exp = exposure_map.get(eid, 1)
        prof = evaluate_edge_voi(g, eid, traffic_exposure=exp)
        profiles.append(prof)

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
