"""Event-grouped split dataset loader and feature matrix compiler."""

import json
from pathlib import Path
from typing import Any

import numpy as np
from app.core.config import settings
from app.ml.features import EdgeFeatureExtractor

from experiments.bench.hazard import compute_hazard_intensity, get_event_by_id
from experiments.bench.manifest import generate_crisisbench_mini


def _benchmark_is_materialised(manifest_path: Path) -> bool:
    """True when the manifest exists and its first instance file contains real road edges."""
    if not manifest_path.exists():
        return False
    first = manifest_path.parent / "instances" / "inst_ev01_01.json"
    if not first.exists():
        return False
    with open(first, encoding="utf-8") as handle:
        return bool(json.load(handle).get("edges"))


def load_split_data(
    manifest_path: Path | None = None,
) -> dict[str, dict[str, Any]]:
    """Compile feature matrices and binary ground-truth labels for train/val/test splits."""
    path = manifest_path or (settings.data_dir / "bench" / "manifest.json")
    if manifest_path is None and not _benchmark_is_materialised(path):
        # Instance files are generated deterministically (seed 42) and are not kept in git
        generate_crisisbench_mini(output_dir=path.parent)
    if not path.exists():
        raise FileNotFoundError(f"CrisisBench manifest not found at {path}")

    with open(path, encoding="utf-8") as f:
        manifest = json.load(f)

    bench_root = path.parent

    splits: dict[str, dict[str, Any]] = {
        "train": {"X": [], "y": [], "road_classes": [], "hazards": []},
        "val": {"X": [], "y": [], "road_classes": [], "hazards": []},
        "test": {"X": [], "y": [], "road_classes": [], "hazards": []},
    }

    extractor = EdgeFeatureExtractor()

    for item in manifest["instances"]:
        split = item["split"]
        inst_file = bench_root / "instances" / f"{item['instance_id']}.json"

        if not inst_file.exists():
            continue

        with open(inst_file, encoding="utf-8") as inf:
            inst = json.load(inf)

        event = get_event_by_id(inst["event_id"])
        edges = inst["edges"]
        observations = inst["observations"]
        ground_truth = inst["ground_truth"]

        # Group observations by edge
        obs_by_edge: dict[str, list[dict[str, Any]]] = {}
        for o in observations:
            e_id = o["edge_id"]
            if e_id not in obs_by_edge:
                obs_by_edge[e_id] = []
            obs_by_edge[e_id].append(o)

        for edge in edges:
            e_id = edge["edge_id"]
            u_lon, u_lat = edge["u_coord"]
            v_lon, v_lat = edge["v_coord"]
            mid_lon = (u_lon + v_lon) / 2.0
            mid_lat = (u_lat + v_lat) / 2.0

            hazard_val = compute_hazard_intensity(mid_lon, mid_lat, event)
            edge_obs = obs_by_edge.get(e_id, [])

            feat_vec, _ = extractor.extract_features(
                edge=edge,
                observations=edge_obs,
                hazard_intensity=hazard_val,
            )

            z_true = ground_truth.get(e_id, {}).get("true_state", 1)

            splits[split]["X"].append(feat_vec)
            splits[split]["y"].append(z_true)
            splits[split]["road_classes"].append(edge.get("road_class", "unclassified"))
            splits[split]["hazards"].append(hazard_val)

    # Convert to NumPy arrays
    compiled_splits: dict[str, dict[str, Any]] = {}
    for sp_name, data in splits.items():
        compiled_splits[sp_name] = {
            "X": np.array(data["X"], dtype=np.float32),
            "y": np.array(data["y"], dtype=np.int32),
            "road_classes": data["road_classes"],
            "hazards": np.array(data["hazards"], dtype=np.float32),
        }

    return compiled_splits
