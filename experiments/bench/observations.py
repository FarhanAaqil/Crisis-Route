"""Observation sampling engine modeling field friction, latency, and contradictions."""

from typing import Any

import numpy as np

SOURCE_PROFILES: list[dict[str, Any]] = [
    {"source_type": "field_patrol", "prob": 0.40, "cred_min": 0.80, "cred_max": 0.95},
    {"source_type": "drone_recon", "prob": 0.20, "cred_min": 0.85, "cred_max": 0.98},
    {
        "source_type": "satellite_radar",
        "prob": 0.15,
        "cred_min": 0.70,
        "cred_max": 0.88,
    },
    {
        "source_type": "local_authority",
        "prob": 0.15,
        "cred_min": 0.75,
        "cred_max": 0.92,
    },
    {"source_type": "citizen_report", "prob": 0.10, "cred_min": 0.40, "cred_max": 0.70},
]


def sample_observations_for_network(
    edges: list[dict[str, Any]],
    true_states: dict[str, int],
    coverage_rate: float,
    staleness_mean_hours: float,
    contradiction_rate: float,
    rng: np.random.Generator,
) -> list[dict[str, Any]]:
    """Sample noisy, time-decayed, and contradictory field observations.

    Args:
        edges: Road edges list.
        true_states: Mapping of edge_id to true state (1=passable, 0=blocked).
        coverage_rate: Fraction of edges receiving reports.
        staleness_mean_hours: Mean age of newest evidence in hours.
        contradiction_rate: Fraction of observed edges that receive conflicting reports.
        rng: NumPy random generator.
    """
    observations: list[dict[str, Any]] = []
    source_choices = [p["source_type"] for p in SOURCE_PROFILES]
    source_weights = [p["prob"] for p in SOURCE_PROFILES]

    for edge in edges:
        edge_id = str(edge["edge_id"])
        # Determine if edge is observed
        if rng.uniform(0.0, 1.0) > coverage_rate:
            continue

        z_true = true_states.get(edge_id, 1)

        # Pick source type
        chosen_source = rng.choice(source_choices, p=source_weights)
        profile = next(p for p in SOURCE_PROFILES if p["source_type"] == chosen_source)
        credibility = round(
            float(rng.uniform(profile["cred_min"], profile["cred_max"])), 3
        )

        # Observation error probability = 1.0 - credibility
        reported_state = (
            z_true if rng.uniform(0.0, 1.0) <= credibility else (1 - z_true)
        )

        status_str = "passable" if reported_state == 1 else "impassable"
        stale_hours = round(float(rng.exponential(scale=staleness_mean_hours)), 1)
        conf_width = round(float(rng.uniform(0.10, 0.25) * (1.1 - credibility)), 3)
        center_prob = 0.85 if reported_state == 1 else 0.15
        lower_bound = max(0.01, round(center_prob - conf_width, 3))
        upper_bound = min(0.99, round(center_prob + conf_width, 3))

        primary_obs = {
            "edge_id": edge_id,
            "status": status_str,
            "source_type": chosen_source,
            "source_credibility": credibility,
            "stale_age_hours": stale_hours,
            "confidence_interval": [lower_bound, upper_bound],
            "water_depth_cm": round(float(rng.uniform(15.0, 80.0)), 1)
            if status_str == "impassable"
            else 0.0,
            "reported_by": f"unit_{rng.integers(101, 999)}",
        }
        observations.append(primary_obs)

        # Deliberately inject a conflicting second report if selected
        if rng.uniform(0.0, 1.0) < contradiction_rate:
            conflicting_status = (
                "impassable" if status_str == "passable" else "passable"
            )
            contradictory_obs = {
                "edge_id": edge_id,
                "status": conflicting_status,
                "source_type": "citizen_report",
                "source_credibility": round(float(rng.uniform(0.40, 0.65)), 3),
                "stale_age_hours": round(stale_hours + float(rng.uniform(1.0, 6.0)), 1),
                "confidence_interval": [
                    0.20,
                    0.80,
                ],  # Wide interval indicating active contradiction
                "water_depth_cm": 0.0 if conflicting_status == "passable" else 30.0,
                "reported_by": f"crowdsource_user_{rng.integers(1000, 9999)}",
            }
            observations.append(contradictory_obs)

    return observations
