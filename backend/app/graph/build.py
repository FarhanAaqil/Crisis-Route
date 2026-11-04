"""Directed road network graph builder using NetworkX."""

from typing import Any

import networkx as nx


def build_directed_graph(edges: list[dict[str, Any]]) -> nx.DiGraph:
    """Construct a NetworkX directed graph from validated road edges.

    Each node stores 'lon' and 'lat'.
    Each edge stores 'edge_id', 'length_m', 'free_flow_sec', 'road_class',
    'bridge', 'slope_pct', and baseline passability probability.
    """
    g = nx.DiGraph()

    for e in edges:
        u = str(e["u_node"])
        v = str(e["v_node"])

        # Add nodes with geographic coordinates if available
        if "u_coord" in e and len(e["u_coord"]) >= 2:
            g.add_node(u, lon=float(e["u_coord"][0]), lat=float(e["u_coord"][1]))
        elif u not in g:
            g.add_node(u)

        if "v_coord" in e and len(e["v_coord"]) >= 2:
            g.add_node(v, lon=float(e["v_coord"][0]), lat=float(e["v_coord"][1]))
        elif v not in g:
            g.add_node(v)

        edge_attrs = {
            "edge_id": str(e.get("edge_id")),
            "length_m": float(e.get("length_m", 100.0)),
            "free_flow_sec": float(e.get("free_flow_sec", 10.0)),
            "road_class": str(e.get("road_class", "unclassified")),
            "bridge": bool(e.get("bridge", False)),
            "slope_pct": float(e.get("slope_pct", 0.0)),
            "passability_prob": float(e.get("passability_prob", 1.0)),
            "stale_age_hours": float(e.get("stale_age_hours", 0.0)),
        }

        # Add directed edge (or update if multiple edges exist between u and v)
        g.add_edge(u, v, **edge_attrs)

    return g


def compute_graph_summary(g: nx.DiGraph) -> dict[str, Any]:
    """Compute structural metrics and summary statistics for a road network."""
    total_length_m = sum(data.get("length_m", 0.0) for _, _, data in g.edges(data=True))

    scc_count = nx.number_strongly_connected_components(g)
    wcc_count = nx.number_weakly_connected_components(g)

    return {
        "node_count": g.number_of_nodes(),
        "edge_count": g.number_of_edges(),
        "total_length_km": round(total_length_m / 1000.0, 2),
        "strongly_connected_components": scc_count,
        "weakly_connected_components": wcc_count,
        "is_strongly_connected": nx.is_strongly_connected(g) if g.number_of_nodes() > 0 else False,
    }
