"""Directed road network graph builder using NetworkX."""

import math
from typing import Any

import networkx as nx

from app.domain.models import ScenarioDetail


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


def compute_haversine_distance_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Approximate distance in meters between two WGS-84 coordinate points."""
    r = 6371000.0  # Earth radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def build_scenario_corridor_graph(scenario: ScenarioDetail) -> nx.DiGraph:
    """Construct a fully connected navigable corridor network for a scenario.

    Creates bidirectional road edges connecting all depots and demand clusters
    with realistic travel times and passability attributes based on terrain.
    """
    g = nx.DiGraph()

    # Add depots
    for d in scenario.depots:
        lon, lat = d.coordinates[0], d.coordinates[1]
        g.add_node(d.id, lon=lon, lat=lat, node_type="depot", name=d.name)

    # Add demand nodes
    for n in scenario.demand_nodes:
        lon, lat = n.coordinates[0], n.coordinates[1]
        g.add_node(n.id, lon=lon, lat=lat, node_type="demand", name=n.name)

    # Central junction to ensure multi-route connectivity
    c_lon = sum(d.coordinates[0] for d in scenario.depots) / max(1, len(scenario.depots))
    c_lat = sum(d.coordinates[1] for d in scenario.depots) / max(1, len(scenario.depots))
    hub_id = "JUNCTION-CENTRAL-HUB"
    g.add_node(hub_id, lon=c_lon, lat=c_lat, node_type="junction", name="Central Relief Hub")

    # Connect depots to hub
    for d in scenario.depots:
        dist_m = compute_haversine_distance_m(d.coordinates[0], d.coordinates[1], c_lon, c_lat)
        dist_m = max(2000.0, dist_m)
        free_flow_sec = round((dist_m / 1000.0) / 40.0 * 3600.0, 1)  # 40 km/h

        e_out = f"EDGE-{d.id}-TO-{hub_id}"
        e_in = f"EDGE-{hub_id}-TO-{d.id}"

        g.add_edge(
            d.id,
            hub_id,
            edge_id=e_out,
            length_m=dist_m,
            free_flow_sec=free_flow_sec,
            road_class="trunk",
            bridge=False,
            slope_pct=3.5,
            passability_prob=0.95,
            stale_age_hours=0.5,
        )
        g.add_edge(
            hub_id,
            d.id,
            edge_id=e_in,
            length_m=dist_m,
            free_flow_sec=free_flow_sec,
            road_class="trunk",
            bridge=False,
            slope_pct=3.5,
            passability_prob=0.95,
            stale_age_hours=0.5,
        )

    # Connect hub to demand nodes, and adjacent demand nodes to each other
    for i, n in enumerate(scenario.demand_nodes):
        dist_m = compute_haversine_distance_m(c_lon, c_lat, n.coordinates[0], n.coordinates[1])
        dist_m = max(3000.0, dist_m)
        free_flow_sec = round((dist_m / 1000.0) / 30.0 * 3600.0, 1)  # 30 km/h in hill terrain

        # Vulnerable or isolated nodes have slightly lower passability
        p_base = 0.88 if n.vulnerable_group.lower() != "general_population" else 0.94

        e_out = f"EDGE-{hub_id}-TO-{n.id}"
        e_in = f"EDGE-{n.id}-TO-{hub_id}"

        g.add_edge(
            hub_id,
            n.id,
            edge_id=e_out,
            length_m=dist_m,
            free_flow_sec=free_flow_sec,
            road_class="primary",
            bridge=True,
            slope_pct=8.0,
            passability_prob=p_base,
            stale_age_hours=1.0,
        )
        g.add_edge(
            n.id,
            hub_id,
            edge_id=e_in,
            length_m=dist_m,
            free_flow_sec=free_flow_sec,
            road_class="primary",
            bridge=True,
            slope_pct=8.0,
            passability_prob=p_base,
            stale_age_hours=1.0,
        )

        # Cross-corridor link with neighboring demand node to provide alternative routes
        next_n = scenario.demand_nodes[(i + 1) % len(scenario.demand_nodes)]
        cross_dist_m = compute_haversine_distance_m(
            n.coordinates[0], n.coordinates[1], next_n.coordinates[0], next_n.coordinates[1]
        )
        cross_dist_m = max(2500.0, cross_dist_m)
        cross_sec = round((cross_dist_m / 1000.0) / 25.0 * 3600.0, 1)

        g.add_edge(
            n.id,
            next_n.id,
            edge_id=f"EDGE-CROSS-{n.id}-TO-{next_n.id}",
            length_m=cross_dist_m,
            free_flow_sec=cross_sec,
            road_class="secondary",
            bridge=False,
            slope_pct=5.0,
            passability_prob=0.91,
            stale_age_hours=2.0,
        )

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
