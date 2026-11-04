"""CrisisBench-mini manifest builder and split leakage validator."""

import json
from pathlib import Path
from typing import Any

import numpy as np
from app.core.config import settings

from experiments.bench.generate import compute_true_edge_passability
from experiments.bench.hazard import DISASTER_EVENTS
from experiments.bench.observations import sample_observations_for_network


def build_synthetic_network_edges(
    bbox: list[float], num_nodes: int = 25
) -> list[dict[str, Any]]:
    """Build a deterministic grid/corridor road network within given bounding box."""
    min_lon, min_lat, max_lon, max_lat = bbox
    rng = np.random.default_rng(1337)

    # Generate grid nodes
    lons = np.linspace(min_lon, max_lon, int(np.sqrt(num_nodes)))
    lats = np.linspace(min_lat, max_lat, int(np.sqrt(num_nodes)))

    nodes: list[tuple[str, float, float]] = []
    idx = 1
    for lon in lons:
        for lat in lats:
            nodes.append((f"N_{idx}", float(lon), float(lat)))
            idx += 1

    edges: list[dict[str, Any]] = []
    road_classes = ["primary", "secondary", "tertiary", "residential", "trunk"]
    edge_idx = 1

    # Connect adjacent nodes horizontally and vertically
    for i, (u_id, u_lon, u_lat) in enumerate(nodes):
        for j, (v_id, v_lon, v_lat) in enumerate(nodes):
            if i >= j:
                continue
            dist_deg = np.sqrt((u_lon - v_lon) ** 2 + (u_lat - v_lat) ** 2)
            # Threshold for adjacent connections
            if dist_deg < (max_lon - min_lon) / (np.sqrt(num_nodes) - 0.5):
                r_class = road_classes[edge_idx % len(road_classes)]
                length_m = round(dist_deg * 111000.0, 1)
                speed_kmh = 50.0 if r_class in ["primary", "trunk"] else 30.0
                free_flow_sec = round((length_m / (speed_kmh * 1000.0 / 3600.0)), 1)
                bridge = edge_idx % 7 == 0
                slope_pct = round(float(rng.uniform(1.0, 15.0)), 1)

                # Directed edge u -> v
                edges.append(
                    {
                        "edge_id": f"E_{edge_idx}_fwd",
                        "u_node": u_id,
                        "v_node": v_id,
                        "u_coord": [u_lon, u_lat],
                        "v_coord": [v_lon, v_lat],
                        "length_m": length_m,
                        "free_flow_sec": free_flow_sec,
                        "road_class": r_class,
                        "bridge": bridge,
                        "slope_pct": slope_pct,
                    }
                )
                edge_idx += 1

                # Directed reverse edge v -> u
                edges.append(
                    {
                        "edge_id": f"E_{edge_idx}_rev",
                        "u_node": v_id,
                        "v_node": u_id,
                        "u_coord": [v_lon, v_lat],
                        "v_coord": [u_lon, u_lat],
                        "length_m": length_m,
                        "free_flow_sec": free_flow_sec,
                        "road_class": r_class,
                        "bridge": bridge,
                        "slope_pct": slope_pct,
                    }
                )
                edge_idx += 1

    return edges


def generate_crisisbench_mini(
    output_dir: Path | None = None,
    instances_per_event: int = 20,
    seed: int = 42,
) -> dict[str, Any]:
    """Generate all 240 scenario instances for CrisisBench-mini and seal manifest.

    12 events * 20 instances = 240 instances.
    Partitions:
        Train: Events 1-8 (160 instances)
        Val: Events 9-10 (40 instances)
        Test: Events 11-12 (40 instances)
    """
    dest_dir = output_dir or (settings.data_dir / "bench")
    dest_dir.mkdir(parents=True, exist_ok=True)
    instances_dir = dest_dir / "instances"
    instances_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(seed)
    instances_manifest: list[dict[str, Any]] = []

    split_counts = {"train": 0, "val": 0, "test": 0}

    for event in DISASTER_EVENTS:
        # Base network for this disaster event
        region_bbox = [
            event.epicenter[0] - 0.25,
            event.epicenter[1] - 0.25,
            event.epicenter[0] + 0.25,
            event.epicenter[1] + 0.25,
        ]
        edges = build_synthetic_network_edges(region_bbox, num_nodes=25)

        # Generate ground truth for all edges under this event
        ground_truth: dict[str, dict[str, Any]] = {}
        true_states_map: dict[str, int] = {}

        for edge in edges:
            p_true, z_true = compute_true_edge_passability(edge, event, rng)
            ground_truth[edge["edge_id"]] = {
                "true_passability_prob": p_true,
                "true_state": z_true,  # 1=open, 0=blocked
            }
            true_states_map[edge["edge_id"]] = z_true

        for inst_idx in range(1, instances_per_event + 1):
            instance_id = f"inst_ev{event.event_id:02d}_{inst_idx:02d}"

            # Parameter perturbations
            coverage_rate = round(float(rng.uniform(0.35, 0.85)), 2)
            staleness_mean_hours = round(float(rng.uniform(4.0, 24.0)), 1)
            contradiction_rate = round(float(rng.uniform(0.05, 0.15)), 2)
            demand_multiplier = round(float(rng.uniform(0.80, 1.40)), 2)
            inventory_multiplier = round(float(rng.uniform(0.70, 1.20)), 2)

            observations = sample_observations_for_network(
                edges=edges,
                true_states=true_states_map,
                coverage_rate=coverage_rate,
                staleness_mean_hours=staleness_mean_hours,
                contradiction_rate=contradiction_rate,
                rng=rng,
            )

            instance_data = {
                "instance_id": instance_id,
                "event_id": event.event_id,
                "event_name": event.name,
                "region_name": event.region_name,
                "hazard_type": event.hazard_type,
                "split": event.split_assignment,
                "parameters": {
                    "coverage_rate": coverage_rate,
                    "staleness_mean_hours": staleness_mean_hours,
                    "contradiction_rate": contradiction_rate,
                    "demand_multiplier": demand_multiplier,
                    "inventory_multiplier": inventory_multiplier,
                },
                "network_summary": {
                    "edge_count": len(edges),
                    "blocked_edge_count": sum(
                        1 for z in true_states_map.values() if z == 0
                    ),
                    "observation_count": len(observations),
                },
                "edges": edges,
                "observations": observations,
                "ground_truth": ground_truth,
            }

            # Save instance file
            inst_file = instances_dir / f"{instance_id}.json"
            with open(inst_file, "w", encoding="utf-8") as f:
                json.dump(instance_data, f, indent=2)

            instances_manifest.append(
                {
                    "instance_id": instance_id,
                    "event_id": event.event_id,
                    "split": event.split_assignment,
                    "hazard_type": event.hazard_type,
                    "region": event.region_name,
                    "file_path": str(inst_file.relative_to(dest_dir.parent)),
                }
            )

            split_counts[event.split_assignment] += 1

    # Verify leakage guard
    train_events = {
        item["event_id"] for item in instances_manifest if item["split"] == "train"
    }
    val_events = {
        item["event_id"] for item in instances_manifest if item["split"] == "val"
    }
    test_events = {
        item["event_id"] for item in instances_manifest if item["split"] == "test"
    }

    assert len(train_events.intersection(test_events)) == 0, (
        "LEAKAGE: Train and Test events overlap!"
    )
    assert len(val_events.intersection(test_events)) == 0, (
        "LEAKAGE: Val and Test events overlap!"
    )
    assert len(train_events.intersection(val_events)) == 0, (
        "LEAKAGE: Train and Val events overlap!"
    )

    manifest = {
        "benchmark_name": "CrisisBench-mini",
        "version": "1.0.0",
        "total_instances": len(instances_manifest),
        "split_summary": split_counts,
        "event_count": len(DISASTER_EVENTS),
        "leakage_verified": True,
        "instances": instances_manifest,
    }

    manifest_file = dest_dir / "manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    return manifest
