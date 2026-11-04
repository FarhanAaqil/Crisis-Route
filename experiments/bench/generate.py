"""Ground-truth generative engine for CrisisBench-mini road network states."""

import numpy as np

from experiments.bench.hazard import DisasterEvent, compute_hazard_intensity

# Sealed physical vulnerability coefficients (hidden from predictive ML models)
ROAD_CLASS_VULNERABILITY: dict[str, float] = {
    "motorway": 0.15,
    "trunk": 0.20,
    "primary": 0.30,
    "secondary": 0.45,
    "tertiary": 0.60,
    "residential": 0.75,
    "unclassified": 0.70,
    "track": 0.85,
    "service": 0.80,
}

BRIDGE_VULNERABILITY_BOOST = 0.25
SLOPE_FRAGILITY_COEFF = 0.015


def compute_true_edge_passability(
    edge: dict,
    event: DisasterEvent,
    rng: np.random.Generator,
) -> tuple[float, int]:
    """Compute true passability probability and sample true binary state z_e in {0, 1}.

    Returns:
        (true_probability, true_state) where 1 = passable, 0 = blocked.
    """
    # Midpoint coordinates
    u_lon, u_lat = edge["u_coord"]
    v_lon, v_lat = edge["v_coord"]
    mid_lon = (u_lon + v_lon) / 2.0
    mid_lat = (u_lat + v_lat) / 2.0

    intensity = compute_hazard_intensity(mid_lon, mid_lat, event)
    road_class = edge.get("road_class", "unclassified")
    base_vuln = ROAD_CLASS_VULNERABILITY.get(road_class, 0.70)

    # Bridge multiplier under flood hazard
    bridge_penalty = (
        BRIDGE_VULNERABILITY_BOOST * intensity if edge.get("bridge", False) else 0.0
    )

    # Slope fragility under landslide or runoff
    slope_pct = float(edge.get("slope_pct", 0.0))
    slope_penalty = min(slope_pct, 25.0) * SLOPE_FRAGILITY_COEFF * intensity

    # Aggregate failure hazard
    total_failure_hazard = (intensity * base_vuln) + bridge_penalty + slope_penalty

    # Unobserved environmental noise (soil saturation, drainage maintenance)
    noise = rng.normal(loc=0.0, scale=0.04)

    # Latent true probability of road survival
    true_prob = 1.0 - total_failure_hazard + noise
    true_prob = float(np.clip(true_prob, 0.01, 0.99))

    # Bernoulli realization of ground-truth state
    true_state = 1 if rng.uniform(0.0, 1.0) < true_prob else 0

    return round(true_prob, 4), true_state
