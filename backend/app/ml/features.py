"""Feature engineering and distribution shift detector for road edges."""

from typing import Any

import numpy as np

ROAD_CLASS_MAP = {
    "motorway": 1.0,
    "trunk": 2.0,
    "primary": 3.0,
    "secondary": 4.0,
    "tertiary": 5.0,
    "residential": 6.0,
    "unclassified": 7.0,
    "track": 8.0,
    "service": 9.0,
}

FEATURE_NAMES = [
    "road_class_code",
    "length_m",
    "free_flow_sec",
    "bridge_flag",
    "slope_pct",
    "hazard_intensity",
    "has_observation",
    "obs_status_score",  # 1.0 = passable, 0.0 = impassable, 0.5 = partial/none
    "obs_credibility",
    "obs_age_hours",
    "is_conflicted",
    "nearby_closure_density",
]


class EdgeFeatureExtractor:
    """Extracts standardized numerical feature vectors from road edges and evidence."""

    @staticmethod
    def extract_features(
        edge: dict[str, Any],
        observations: list[dict[str, Any]] | None = None,
        hazard_intensity: float = 0.0,
        nearby_closure_density: float = 0.0,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        """Extract a 12-dimensional feature vector and structured feature summary."""
        road_class = str(edge.get("road_class", "unclassified")).lower()
        road_class_code = ROAD_CLASS_MAP.get(road_class, 7.0)

        length_m = float(edge.get("length_m", 100.0))
        free_flow_sec = float(edge.get("free_flow_sec", 10.0))
        bridge_flag = 1.0 if edge.get("bridge", False) else 0.0
        slope_pct = float(edge.get("slope_pct", 0.0))

        # Process observations for this edge
        edge_obs = observations or []
        has_obs = 1.0 if len(edge_obs) > 0 else 0.0

        obs_status_score = 0.5  # Neutral prior if no observation
        obs_credibility = 0.5
        obs_age_hours = 0.0
        is_conflicted = 0.0

        if edge_obs:
            # Sort by newest (smallest age)
            sorted_obs = sorted(edge_obs, key=lambda o: float(o.get("stale_age_hours", 0.0)))
            newest = sorted_obs[0]
            status_str = str(newest.get("status", "passable")).lower()

            if status_str == "passable":
                obs_status_score = 1.0
            elif status_str in ["impassable", "blocked"]:
                obs_status_score = 0.0
            else:
                obs_status_score = 0.5

            obs_credibility = float(newest.get("source_credibility", 0.8))
            obs_age_hours = float(newest.get("stale_age_hours", 0.0))

            # Detect conflicting reports
            statuses = {str(o.get("status", "")).lower() for o in edge_obs}
            if (
                len(statuses) > 1
                and "passable" in statuses
                and ("impassable" in statuses or "blocked" in statuses)
            ):
                is_conflicted = 1.0

        features_dict = {
            "road_class_code": road_class_code,
            "length_m": length_m,
            "free_flow_sec": free_flow_sec,
            "bridge_flag": bridge_flag,
            "slope_pct": slope_pct,
            "hazard_intensity": hazard_intensity,
            "has_observation": has_obs,
            "obs_status_score": obs_status_score,
            "obs_credibility": obs_credibility,
            "obs_age_hours": obs_age_hours,
            "is_conflicted": is_conflicted,
            "nearby_closure_density": nearby_closure_density,
        }

        vector = np.array([features_dict[name] for name in FEATURE_NAMES], dtype=np.float32)
        return vector, features_dict


class DistributionShiftDetector:
    """Detects when an edge's features lie outside the empirical training support."""

    def __init__(self, tolerance_pct: float = 0.20) -> None:
        self.tolerance_pct = tolerance_pct
        self.min_bounds: dict[str, float] = {}
        self.max_bounds: dict[str, float] = {}
        self.is_fitted: bool = False

    def fit(self, feature_matrix: np.ndarray) -> None:
        """Fit empirical min/max hypercube bounding box on training features."""
        for i, name in enumerate(FEATURE_NAMES):
            col = feature_matrix[:, i]
            val_min = float(np.min(col))
            val_max = float(np.max(col))
            spread = max(val_max - val_min, 1.0)

            # Pad bounding box by tolerance factor
            self.min_bounds[name] = val_min - (spread * self.tolerance_pct)
            self.max_bounds[name] = val_max + (spread * self.tolerance_pct)

        self.is_fitted = True

    def detect_shift(self, feature_vector: np.ndarray) -> tuple[bool, list[str]]:
        """Return (True, [violating_features]) if feature falls outside training envelope."""
        if not self.is_fitted:
            return False, []

        violations: list[str] = []
        for i, name in enumerate(FEATURE_NAMES):
            val = float(feature_vector[i])
            if val < self.min_bounds[name] or val > self.max_bounds[name]:
                violations.append(name)

        return (len(violations) > 0), violations
