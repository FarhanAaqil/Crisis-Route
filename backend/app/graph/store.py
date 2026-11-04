"""Graph serialization, persistence, and cryptographic metadata hashing."""

import hashlib
import json
from pathlib import Path
from typing import Any

import networkx as nx

from app.core.config import settings


def compute_graph_hash(g: nx.DiGraph) -> str:
    """Compute a deterministic SHA-256 hash across sorted nodes and edges."""
    canonical_nodes = sorted(
        [
            (
                str(node),
                round(float(data.get("lon", 0.0)), 6),
                round(float(data.get("lat", 0.0)), 6),
            )
            for node, data in g.nodes(data=True)
        ],
        key=lambda x: x[0],
    )

    canonical_edges = sorted(
        [
            (
                str(u),
                str(v),
                str(data.get("edge_id", "")),
                round(float(data.get("length_m", 0.0)), 2),
                round(float(data.get("free_flow_sec", 0.0)), 2),
                str(data.get("road_class", "")),
            )
            for u, v, data in g.edges(data=True)
        ],
        key=lambda x: (x[0], x[1], x[2]),
    )

    payload = {"nodes": canonical_nodes, "edges": canonical_edges}
    canonical_str = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()


def serialize_graph(g: nx.DiGraph, extra_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    """Serialize NetworkX directed graph into a JSON-compatible dictionary."""
    graph_hash = compute_graph_hash(g)
    node_link = nx.node_link_data(g)

    return {
        "graph_hash": graph_hash,
        "node_count": g.number_of_nodes(),
        "edge_count": g.number_of_edges(),
        "metadata": extra_metadata or {},
        "graph_data": node_link,
    }


def deserialize_graph(serialized: dict[str, Any]) -> tuple[nx.DiGraph, str]:
    """Reconstruct NetworkX directed graph from dictionary and verify its hash."""
    graph_data = serialized["graph_data"]
    # Handle NetworkX version differences in node_link_graph
    g = nx.node_link_graph(graph_data, directed=True)

    expected_hash = serialized.get("graph_hash")
    computed_hash = compute_graph_hash(g)

    if expected_hash and expected_hash != computed_hash:
        raise ValueError(
            f"Graph hash integrity check failed! Expected {expected_hash}, computed {computed_hash}"
        )

    return g, computed_hash


class GraphStore:
    """Filesystem repository for serialized road network graphs."""

    def __init__(self, storage_dir: Path | None = None) -> None:
        self.storage_dir = (storage_dir or settings.artifacts_dir) / "graphs"
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def save_graph(
        self, g: nx.DiGraph, name: str, metadata: dict[str, Any] | None = None
    ) -> tuple[Path, str]:
        """Save graph to disk and return file path and graph hash."""
        serialized = serialize_graph(g, extra_metadata=metadata)
        graph_hash = serialized["graph_hash"]
        target_path = self.storage_dir / f"{name}_{graph_hash[:16]}.json"

        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(serialized, f, indent=2)

        return target_path, graph_hash

    def load_graph(self, file_path: str | Path) -> tuple[nx.DiGraph, str]:
        """Load graph from JSON file."""
        path = Path(file_path)
        with open(path, encoding="utf-8") as f:
            serialized = json.load(f)
        return deserialize_graph(serialized)


graph_store = GraphStore()
