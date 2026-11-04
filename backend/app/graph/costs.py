"""Edge impedance, risk penalization, and staleness cost models."""

import math
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import networkx as nx


@dataclass(frozen=True)
class EdgeCostParameters:
    """Parameters governing edge traversal cost under hazard uncertainty.

    c_e = t_e + lambda_r * (-ln(max(p_e, epsilon))) + lambda_s * staleness_hours
    """

    lambda_r: float = 60.0  # Weight on log-risk
    lambda_s: float = 2.0  # Penalty per hour of evidence staleness
    min_passability: float = 0.01  # Numerical safeguard floor
    max_passability: float = 0.999  # Upper safeguard ceiling


@dataclass
class PathSummary:
    """Comprehensive traversal and reliability metrics for a route."""

    node_path: list[str]
    edge_ids: list[str]
    travel_time_sec: float
    travel_time_min: float
    survival_probability: float
    total_cost: float
    bottleneck_edge_id: str | None
    bottleneck_passability: float


def compute_edge_impedance(
    free_flow_sec: float,
    passability_prob: float,
    stale_age_hours: float = 0.0,
    params: EdgeCostParameters | None = None,
) -> float:
    """Calculate combined physical and risk-adjusted impedance for a road edge."""
    cfg = params or EdgeCostParameters()
    safe_p = max(cfg.min_passability, min(cfg.max_passability, passability_prob))
    log_risk = -math.log(safe_p)
    staleness = cfg.lambda_s * max(0.0, stale_age_hours)

    cost = free_flow_sec + (cfg.lambda_r * log_risk) + staleness
    return max(0.1, float(cost))


def annotate_graph_costs(
    g: nx.DiGraph,
    params: EdgeCostParameters | None = None,
    cost_attr: str = "cost",
) -> None:
    """Annotate every edge in the graph with an impedance cost attribute in-place."""
    cfg = params or EdgeCostParameters()
    for _u, _v, data in g.edges(data=True):
        free_flow = float(data.get("free_flow_sec", 10.0))
        p = float(data.get("passability_prob", 1.0))
        age = float(data.get("stale_age_hours", 0.0))
        data[cost_attr] = compute_edge_impedance(free_flow, p, age, cfg)


def summarize_path(g: nx.DiGraph, node_path: list[str]) -> PathSummary:
    """Extract traversal time, survival probability, and bottleneck from a node sequence."""
    if not node_path or len(node_path) < 2:
        return PathSummary(
            node_path=node_path,
            edge_ids=[],
            travel_time_sec=0.0,
            travel_time_min=0.0,
            survival_probability=1.0,
            total_cost=0.0,
            bottleneck_edge_id=None,
            bottleneck_passability=1.0,
        )

    edge_ids: list[str] = []
    total_time_sec = 0.0
    total_cost = 0.0
    survival_prob = 1.0
    bottleneck_edge: str | None = None
    min_p = 1.0

    for i in range(len(node_path) - 1):
        u, v = node_path[i], node_path[i + 1]
        if not g.has_edge(u, v):
            raise ValueError(f"Edge ({u}, {v}) does not exist in graph")

        data: dict[str, Any] = g[u][v]
        eid = str(data.get("edge_id", f"{u}_{v}"))
        edge_ids.append(eid)

        t_sec = float(data.get("free_flow_sec", 10.0))
        p = float(data.get("passability_prob", 1.0))
        cost = float(data.get("cost", t_sec))

        total_time_sec += t_sec
        total_cost += cost
        survival_prob *= p

        if p < min_p:
            min_p = p
            bottleneck_edge = eid

    return PathSummary(
        node_path=node_path,
        edge_ids=edge_ids,
        travel_time_sec=round(total_time_sec, 2),
        travel_time_min=round(total_time_sec / 60.0, 2),
        survival_probability=round(survival_prob, 4),
        total_cost=round(total_cost, 2),
        bottleneck_edge_id=bottleneck_edge,
        bottleneck_passability=round(min_p, 4),
    )


def _make_impedance_weight_func(
    cost_params: EdgeCostParameters,
) -> Callable[[str, str, dict[str, Any]], float]:
    """Create a Dijkstra weight function bound to the given parameters."""

    def weight_func(_u: str, _v: str, edge_data: dict[str, Any]) -> float:
        return compute_edge_impedance(
            free_flow_sec=float(edge_data.get("free_flow_sec", 10.0)),
            passability_prob=float(edge_data.get("passability_prob", 1.0)),
            stale_age_hours=float(edge_data.get("stale_age_hours", 0.0)),
            params=cost_params,
        )

    return weight_func


def sweep_risk_sensitivity(
    g: nx.DiGraph,
    source: str,
    target: str,
    lambda_values: list[float] | None = None,
) -> list[dict[str, Any]]:
    """Compute shortest paths under differing risk aversion multipliers lambda_r."""
    if lambda_values is None:
        lambda_values = [0.0, 15.0, 30.0, 60.0, 120.0, 300.0]

    results: list[dict[str, Any]] = []

    for lam in lambda_values:
        params = EdgeCostParameters(lambda_r=lam, lambda_s=0.0)
        weight_func = _make_impedance_weight_func(params)

        try:
            path = nx.dijkstra_path(g, source, target, weight=weight_func)
            summary = summarize_path(g, path)
            results.append(
                {
                    "lambda_r": lam,
                    "path": summary.node_path,
                    "travel_time_min": summary.travel_time_min,
                    "survival_probability": summary.survival_probability,
                    "bottleneck_passability": summary.bottleneck_passability,
                }
            )
        except nx.NetworkXNoPath:
            results.append(
                {
                    "lambda_r": lam,
                    "path": [],
                    "travel_time_min": None,
                    "survival_probability": 0.0,
                    "bottleneck_passability": 0.0,
                }
            )

    return results
