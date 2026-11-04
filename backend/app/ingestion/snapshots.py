"""Immutable content-addressed snapshot generator and repository."""

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from app.core.config import settings


class SnapshotMetadata(BaseModel):
    """Immutable metadata descriptor for a content-addressed snapshot."""

    snapshot_id: str = Field(..., min_length=64, max_length=64)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    region_name: str
    bbox: list[float]
    edge_count: int
    node_count: int
    depot_count: int
    demand_node_count: int
    source_attribution: str
    content_hash: str


class SnapshotBundle(BaseModel):
    """Complete content of an immutable snapshot."""

    metadata: SnapshotMetadata
    road_edges: list[dict[str, Any]]
    depots: list[dict[str, Any]]
    demand_nodes: list[dict[str, Any]]
    vehicles: list[dict[str, Any]]


class SnapshotRepository:
    """Storage manager for content-addressed immutable snapshots."""

    def __init__(self, base_dir: Path | None = None) -> None:
        self.snapshots_dir = (base_dir or settings.artifacts_dir) / "snapshots"
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)
        self._memory_cache: dict[str, SnapshotBundle] = {}

    @staticmethod
    def compute_canonical_hash(payload: dict[str, Any]) -> str:
        """Compute deterministic SHA-256 hash over canonical JSON representation."""
        canonical_str = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical_str.encode("utf-8")).hexdigest()

    def create_snapshot(
        self,
        region_name: str,
        bbox: list[float],
        road_edges: list[dict[str, Any]],
        depots: list[dict[str, Any]],
        demand_nodes: list[dict[str, Any]],
        vehicles: list[dict[str, Any]],
        source_attribution: str = "OpenStreetMap contributors (ODbL) / CrisisBench-mini",
    ) -> SnapshotBundle:
        """Create an immutable snapshot sealed by a canonical SHA-256 hash."""
        # Sort collections by primary identifier for canonical determinism
        sorted_edges = sorted(road_edges, key=lambda e: str(e.get("edge_id", "")))
        sorted_depots = sorted(depots, key=lambda d: str(d.get("id", "")))
        sorted_demand = sorted(demand_nodes, key=lambda dn: str(dn.get("id", "")))
        sorted_vehicles = sorted(vehicles, key=lambda v: str(v.get("id", "")))

        # Collect unique nodes
        nodes = set()
        for e in sorted_edges:
            if "u_node" in e:
                nodes.add(e["u_node"])
            if "v_node" in e:
                nodes.add(e["v_node"])

        canonical_payload = {
            "region_name": region_name,
            "bbox": [round(float(coord), 6) for coord in bbox],
            "road_edges": sorted_edges,
            "depots": sorted_depots,
            "demand_nodes": sorted_demand,
            "vehicles": sorted_vehicles,
            "source_attribution": source_attribution,
        }

        content_hash = self.compute_canonical_hash(canonical_payload)
        snapshot_id = content_hash

        metadata = SnapshotMetadata(
            snapshot_id=snapshot_id,
            region_name=region_name,
            bbox=bbox,
            edge_count=len(sorted_edges),
            node_count=len(nodes),
            depot_count=len(sorted_depots),
            demand_node_count=len(sorted_demand),
            source_attribution=source_attribution,
            content_hash=content_hash,
        )

        bundle = SnapshotBundle(
            metadata=metadata,
            road_edges=sorted_edges,
            depots=sorted_depots,
            demand_nodes=sorted_demand,
            vehicles=sorted_vehicles,
        )

        # Persist to disk
        snapshot_folder = self.snapshots_dir / snapshot_id
        snapshot_folder.mkdir(parents=True, exist_ok=True)

        meta_file = snapshot_folder / "metadata.json"
        with open(meta_file, "w", encoding="utf-8") as f:
            f.write(metadata.model_dump_json(indent=2))

        data_file = snapshot_folder / "data.json"
        with open(data_file, "w", encoding="utf-8") as f:
            f.write(bundle.model_dump_json(indent=2))

        self._memory_cache[snapshot_id] = bundle
        return bundle

    def get_snapshot(self, snapshot_id: str) -> SnapshotBundle | None:
        """Retrieve snapshot bundle from memory or disk by its SHA-256 hash."""
        if snapshot_id in self._memory_cache:
            return self._memory_cache[snapshot_id]

        snapshot_folder = self.snapshots_dir / snapshot_id
        data_file = snapshot_folder / "data.json"
        if not data_file.exists():
            return None

        with open(data_file, encoding="utf-8") as f:
            raw_data = json.load(f)

        bundle = SnapshotBundle(**raw_data)
        self._memory_cache[snapshot_id] = bundle
        return bundle


snapshot_repository = SnapshotRepository()
