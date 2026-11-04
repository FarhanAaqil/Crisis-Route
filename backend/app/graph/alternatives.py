"""Yen's k-shortest loopless paths algorithm and route diversity metrics."""

from typing import Any

import networkx as nx

from app.graph.routing import compute_edge_cost


def compute_jaccard_edge_overlap(edges_a: list[str], edges_b: list[str]) -> float:
    """Calculate Jaccard similarity index between two edge sequences."""
    set_a = set(edges_a)
    set_b = set(edges_b)

    if not set_a and not set_b:
        return 1.0

    intersection = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    return round(intersection / max(union, 1), 3)


def find_k_diverse_alternatives(
    g: nx.DiGraph,
    source: str,
    target: str,
    k: int = 3,
    lambda_r: float = 60.0,
    lambda_s: float = 2.0,
) -> list[dict[str, Any]]:
    """Generate k-shortest loopless alternative paths using Yen's algorithm.

    Each path returns:
        - 'node_path': list of nodes
        - 'edge_path': list of edge IDs
        - 'travel_time_sec': free flow travel time in seconds
        - 'survival_prob': multiplicative path survival probability
        - 'jaccard_overlap_with_primary': Jaccard edge overlap with path 1
        - 'eta_inflation_pct': relative travel time increase over path 1
    """
    if source not in g or target not in g:
        raise ValueError(f"Source '{source}' or target '{target}' not present in graph")

    def weight_func(u: str, v: str, edge_data: dict[str, Any]) -> float:
        return float(
            compute_edge_cost(
                free_flow_sec=float(edge_data.get("free_flow_sec", 10.0)),
                passability_prob=float(edge_data.get("passability_prob", 1.0)),
                stale_age_hours=float(edge_data.get("stale_age_hours", 0.0)),
                lambda_r=lambda_r,
                lambda_s=lambda_s,
            )
        )

    # Use networkx shortest_simple_paths (Yen's loopless path generator)
    path_generator = nx.shortest_simple_paths(g, source, target, weight=weight_func)

    routes: list[dict[str, Any]] = []
    primary_edges: list[str] = []
    primary_time: float = 1.0

    count = 0
    try:
        for node_path in path_generator:
            edge_ids: list[str] = []
            travel_time = 0.0
            survival_prob = 1.0

            for i in range(len(node_path) - 1):
                u, v = node_path[i], node_path[i + 1]
                data = g[u][v]
                edge_ids.append(str(data.get("edge_id", f"{u}_{v}")))
                travel_time += float(data.get("free_flow_sec", 10.0))
                survival_prob *= float(data.get("passability_prob", 1.0))

            if count == 0:
                primary_edges = edge_ids
                primary_time = max(travel_time, 1.0)
                jaccard = 1.0
                inflation = 0.0
            else:
                jaccard = compute_jaccard_edge_overlap(primary_edges, edge_ids)
                inflation = round(((travel_time - primary_time) / primary_time) * 100.0, 1)

            routes.append(
                {
                    "rank": count + 1,
                    "node_path": node_path,
                    "edge_path": edge_ids,
                    "travel_time_sec": round(travel_time, 1),
                    "travel_time_min": round(travel_time / 60.0, 1),
                    "survival_prob": round(survival_prob, 4),
                    "jaccard_overlap_with_primary": jaccard,
                    "eta_inflation_pct": inflation,
                }
            )

            count += 1
            if count >= k:
                break
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        pass

    if not routes:
        raise ValueError(f"No navigable path exists between '{source}' and '{target}'")

    return routes
