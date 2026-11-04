"""Frequency lookup and logistic regression passability baselines."""

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler


class FrequencyBaseline:
    """Smoothed road-class x hazard frequency lookup table baseline."""

    def __init__(self, smoothing: float = 2.0) -> None:
        self.smoothing = smoothing
        self.table: dict[tuple[str, int], float] = {}
        self.global_prior: float = 0.70

    @staticmethod
    def _hazard_bin(hazard_intensity: float) -> int:
        """Map hazard intensity to 4 discrete severity bins (0, 1, 2, 3)."""
        if hazard_intensity < 0.20:
            return 0
        if hazard_intensity < 0.50:
            return 1
        if hazard_intensity < 0.80:
            return 2
        return 3

    def fit(self, road_classes: list[str], hazards: list[float], labels: list[int]) -> None:
        """Train frequency lookup table with Laplace smoothing."""
        counts: dict[tuple[str, int], list[int]] = {}

        for rc, h, y in zip(road_classes, hazards, labels, strict=False):
            key = (str(rc).lower(), self._hazard_bin(float(h)))
            if key not in counts:
                counts[key] = [0, 0]  # [total_samples, total_passable]
            counts[key][0] += 1
            if y == 1:
                counts[key][1] += 1

        total_passable = sum(y for y in labels)
        self.global_prior = total_passable / max(len(labels), 1)

        for key, (tot, pass_cnt) in counts.items():
            # Laplace / m-estimate smoothing towards global prior
            smoothed_prob = (pass_cnt + (self.smoothing * self.global_prior)) / (
                tot + self.smoothing
            )
            self.table[key] = float(np.clip(smoothed_prob, 0.05, 0.95))

    def predict_proba(self, road_class: str, hazard_intensity: float) -> float:
        """Query lookup table with fallback to global prior."""
        key = (str(road_class).lower(), self._hazard_bin(hazard_intensity))
        return self.table.get(key, self.global_prior)


class LogisticRegressionBaseline:
    """Regularized logistic regression passability model."""

    def __init__(self, c_param: float = 1.0) -> None:
        self.scaler = StandardScaler()
        self.model = LogisticRegression(C=c_param, max_iter=500, random_state=42)
        self.is_fitted: bool = False

    def fit(self, x_matrix: np.ndarray, y_labels: np.ndarray) -> None:
        """Fit standardized logistic regression."""
        x_scaled = self.scaler.fit_transform(x_matrix)
        self.model.fit(x_scaled, y_labels)
        self.is_fitted = True

    def predict_proba(self, x_vector: np.ndarray) -> float:
        """Output predicted probability of road being passable."""
        if not self.is_fitted:
            return 0.50
        x_2d = x_vector.reshape(1, -1)
        x_scaled = self.scaler.transform(x_2d)
        prob = self.model.predict_proba(x_scaled)[0, 1]
        return float(np.clip(prob, 0.01, 0.99))
