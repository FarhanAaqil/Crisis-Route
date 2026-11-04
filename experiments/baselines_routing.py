"""Routing baseline strategies and comparative safety evaluation metrics.

Implements pre-registered routing policies:
1. Shortest-Time Nominal: Ignores passability uncertainty, routes on free-flow time.
2. Hard-Threshold Heuristic: Drops edges with p_e < threshold (e.g. 0.35), then routes on time.
3. Risk-Aware (CrisisRoute): Balances time and reliability via log-risk impedance penalty.
"""

from dataclasses import dataclass
from typing import Any

import networkx as nx
from app.graph.costs import EdgeCostParameters, compute_edge_impedance, summarize_path


@dataclass(frozen=True)
class RouteResult:
    """Standardized output of a routing policy execution."""

    policy_name: str
    source: str
    target: str
    path_nodes: list[str]
    edge_ids: list[str]
    travel_time_sec: float
    travel_time_min: float
    survival_probability: float
    bottleneck_passability: float
    is_connected: bool
    is_severed_under_ground_truth: bool | None = None


def route_shortest_time(g: nx.DiGraph, source: str, target: str) -> RouteResult:
    """Policy 1: Nominal Shortest-Time Dijkstra ignoring passability hazards."""
    if source not in g or target not in g:
        return RouteResult(
            policy_name="shortest_time",
            source=source,
            target=target,
            path_nodes=[],
            edge_ids=[],
            travel_time_sec=float("inf"),
            travel_time_min=float("inf"),
            survival_probability=0.0,
            bottleneck_passability=0.0,
            is_connected=False,
        )

    try:
        path = nx.dijkstra_path(
            g,
            source,
            target,
            weight=lambda _u, _v, d: float(d.get("free_flow_sec", 10.0)),
        )
        summary = summarize_path(g, path)
        return RouteResult(
            policy_name="shortest_time",
            source=source,
            target=target,
            path_nodes=summary.node_path,
            edge_ids=summary.edge_ids,
            travel_time_sec=summary.travel_time_sec,
            travel_time_min=summary.travel_time_min,
            survival_probability=summary.survival_probability,
            bottleneck_passability=summary.bottleneck_passability,
            is_connected=True,
        )
    except nx.NetworkXNoPath:
        return RouteResult(
            policy_name="shortest_time",
            source=source,
            target=target,
            path_nodes=[],
            edge_ids=[],
            travel_time_sec=float("inf"),
            travel_time_min=float("inf"),
            survival_probability=0.0,
            bottleneck_passability=0.0,
            is_connected=False,
        )


def route_hard_threshold(
    g: nx.DiGraph,
    source: str,
    target: str,
    passability_cutoff: float = 0.35,
) -> RouteResult:
    """Policy 2: Hard-Threshold filtering dropping links with p_e < cutoff."""

    # Build filtered subgraph view
    def filter_edge(u: str, v: str) -> bool:
        p = float(g[u][v].get("passability_prob", 1.0))
        return p >= passability_cutoff

    subview = nx.subgraph_view(g, filter_edge=filter_edge)

    if source not in subview or target not in subview:
        return RouteResult(
            policy_name=f"hard_threshold_{passability_cutoff}",
            source=source,
            target=target,
            path_nodes=[],
            edge_ids=[],
            travel_time_sec=float("inf"),
            travel_time_min=float("inf"),
            survival_probability=0.0,
            bottleneck_passability=0.0,
            is_connected=False,
        )

    try:
        path = nx.dijkstra_path(
            subview,
            source,
            target,
            weight=lambda _u, _v, d: float(d.get("free_flow_sec", 10.0)),
        )
        summary = summarize_path(g, path)
        return RouteResult(
            policy_name=f"hard_threshold_{passability_cutoff}",
            source=source,
            target=target,
            path_nodes=summary.node_path,
            edge_ids=summary.edge_ids,
            travel_time_sec=summary.travel_time_sec,
            travel_time_min=summary.travel_time_min,
            survival_probability=summary.survival_probability,
            bottleneck_passability=summary.bottleneck_passability,
            is_connected=True,
        )
    except nx.NetworkXNoPath:
        return RouteResult(
            policy_name=f"hard_threshold_{passability_cutoff}",
            source=source,
            target=target,
            path_nodes=[],
            edge_ids=[],
            travel_time_sec=float("inf"),
            travel_time_min=float("inf"),
            survival_probability=0.0,
            bottleneck_passability=0.0,
            is_connected=False,
        )


def route_risk_aware(
    g: nx.DiGraph,
    source: str,
    target: str,
    lambda_r: float = 60.0,
    lambda_s: float = 2.0,
) -> RouteResult:
    """Policy 3: CrisisRoute Risk-Aware Dijkstra with log-risk and staleness penalties."""
    params = EdgeCostParameters(lambda_r=lambda_r, lambda_s=lambda_s)

    def weight_func(_u: str, _v: str, d: dict[str, Any]) -> float:
        return float(
            compute_edge_impedance(
                free_flow_sec=float(d.get("free_flow_sec", 10.0)),
                passability_prob=float(d.get("passability_prob", 1.0)),
                stale_age_hours=float(d.get("stale_age_hours", 0.0)),
                params=params,
            )
        )

    try:
        path = nx.dijkstra_path(g, source, target, weight=weight_func)
        summary = summarize_path(g, path)
        return RouteResult(
            policy_name="risk_aware",
            source=source,
            target=target,
            path_nodes=summary.node_path,
            edge_ids=summary.edge_ids,
            travel_time_sec=summary.travel_time_sec,
            travel_time_min=summary.travel_time_min,
            survival_probability=summary.survival_probability,
            bottleneck_passability=summary.bottleneck_passability,
            is_connected=True,
        )
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return RouteResult(
            policy_name="risk_aware",
            source=source,
            target=target,
            path_nodes=[],
            edge_ids=[],
            travel_time_sec=float("inf"),
            travel_time_min=float("inf"),
            survival_probability=0.0,
            bottleneck_passability=0.0,
            is_connected=False,
        )


def evaluate_routing_policies(
    g: nx.DiGraph,
    od_pairs: list[tuple[str, str]],
    ground_truth_blocks: set[str] | None = None,
) -> dict[str, dict[str, float]]:
    """Compare Shortest-Time, Hard-Threshold, and Risk-Aware routing across OD pairs.

    Returns aggregated summary metrics:
    - mean_survival_probability
    - disconnection_rate (fraction of pairs where no route was found)
    - severance_rate (fraction of routed paths that traversed ground-truth blocked edges)
    - mean_travel_time_min (over connected pairs)
    """
    policies = {
        "shortest_time": lambda u, v: route_shortest_time(g, u, v),
        "hard_threshold_0.35": lambda u, v: route_hard_threshold(g, u, v, 0.35),
        "risk_aware": lambda u, v: route_risk_aware(g, u, v, lambda_r=60.0),
    }

    metrics: dict[str, dict[str, float]] = {}

    for name, route_fn in policies.items():
        results: list[RouteResult] = []
        for src, tgt in od_pairs:
            res = route_fn(src, tgt)
            if ground_truth_blocks is not None and res.is_connected:
                # check if any edge in route is actually blocked
                severed = any(eid in ground_truth_blocks for eid in res.edge_ids)
                res = RouteResult(
                    policy_name=res.policy_name,
                    source=res.source,
                    target=res.target,
                    path_nodes=res.path_nodes,
                    edge_ids=res.edge_ids,
                    travel_time_sec=res.travel_time_sec,
                    travel_time_min=res.travel_time_min,
                    survival_probability=res.survival_probability,
                    bottleneck_passability=res.bottleneck_passability,
                    is_connected=res.is_connected,
                    is_severed_under_ground_truth=severed,
                )
            results.append(res)

        total_pairs = len(results)
        connected = [r for r in results if r.is_connected]
        disconnection_rate = (
            (total_pairs - len(connected)) / total_pairs if total_pairs > 0 else 0.0
        )

        mean_survival = (
            sum(r.survival_probability for r in connected) / len(connected)
            if connected
            else 0.0
        )
        mean_time = (
            sum(r.travel_time_min for r in connected) / len(connected)
            if connected
            else 0.0
        )

        severance_rate = 0.0
        if ground_truth_blocks is not None and connected:
            severed_count = sum(
                1 for r in connected if r.is_severed_under_ground_truth is True
            )
            severance_rate = severed_count / len(connected)

        metrics[name] = {
            "disconnection_rate": round(disconnection_rate, 4),
            "mean_survival_probability": round(mean_survival, 4),
            "mean_travel_time_min": round(mean_time, 2),
            "severance_rate": round(severance_rate, 4),
        }

    return metrics
