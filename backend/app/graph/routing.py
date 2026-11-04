"""Deterministic Dijkstra routing under risk- and staleness-adjusted edge costs."""

import math
from typing import Any

import networkx as nx


def compute_edge_cost(
    free_flow_sec: float,
    passability_prob: float,
    stale_age_hours: float = 0.0,
    lambda_r: float = 60.0,
    lambda_s: float = 2.0,
) -> float:
    """Compute risk- and staleness-penalized edge impedance cost:

    c_e = t_e + lambda_r * (-log(max(p_e, 0.01))) + lambda_s * a_e
    """
    safe_p = max(0.01, min(0.999, passability_prob))
    log_risk_penalty = -math.log(safe_p)
    staleness_penalty = lambda_s * max(0.0, stale_age_hours)

    cost = free_flow_sec + (lambda_r * log_risk_penalty) + staleness_penalty
    return max(0.1, float(cost))


def find_shortest_path(
    g: nx.DiGraph,
    source: str,
    target: str,
    weight_mode: str = "risk_adjusted",
    lambda_r: float = 60.0,
    lambda_s: float = 2.0,
) -> tuple[list[str], list[str], float, float]:
    """Find deterministic shortest path between source and target nodes.

    Args:
        g: Directed road network.
        source: Origin node ID.
        target: Destination node ID.
        weight_mode: 'risk_adjusted' or 'free_flow' (travel time only baseline).
        lambda_r: Weight on negative log-survival probability.
        lambda_s: Penalty per hour of evidence staleness.

    Returns:
        (node_path, edge_id_path, total_travel_time_sec, path_survival_probability)
    """
    if source not in g or target not in g:
        raise ValueError(f"Source '{source}' or target '{target}' not present in graph")

    def weight_func(u: str, v: str, edge_data: dict[str, Any]) -> float:
        if weight_mode == "free_flow":
            return float(edge_data.get("free_flow_sec", 10.0))
        return float(
            compute_edge_cost(
                free_flow_sec=float(edge_data.get("free_flow_sec", 10.0)),
                passability_prob=float(edge_data.get("passability_prob", 1.0)),
                stale_age_hours=float(edge_data.get("stale_age_hours", 0.0)),
                lambda_r=lambda_r,
                lambda_s=lambda_s,
            )
        )

    try:
        node_path = nx.dijkstra_path(g, source, target, weight=weight_func)
    except nx.NetworkXNoPath as err:
        raise ValueError(f"No navigable path exists between '{source}' and '{target}'") from err

    edge_id_path: list[str] = []
    total_travel_time_sec = 0.0
    survival_prob = 1.0

    for i in range(len(node_path) - 1):
        u, v = node_path[i], node_path[i + 1]
        data = g[u][v]
        edge_id_path.append(str(data.get("edge_id", f"{u}_{v}")))
        total_travel_time_sec += float(data.get("free_flow_sec", 10.0))
        survival_prob *= float(data.get("passability_prob", 1.0))

    return node_path, edge_id_path, round(total_travel_time_sec, 1), round(survival_prob, 4)
