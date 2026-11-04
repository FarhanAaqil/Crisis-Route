"""Calibrated gradient-boosted passability model with credible intervals."""

from typing import Any

import numpy as np
from scipy.special import expit, logit
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.isotonic import IsotonicRegression

from app.ml.features import DistributionShiftDetector


class CalibratedPassabilityModel:
    """Gradient-boosted trees with post-hoc isotonic calibration and epistemic intervals."""

    def __init__(
        self,
        model_version: str = "v1.0.0-gbdt-isotonic",
        random_seed: int = 42,
    ) -> None:
        self.model_version = model_version
        self.random_seed = random_seed

        # Base gradient boosted classifier
        self.base_model = HistGradientBoostingClassifier(
            max_iter=100,
            learning_rate=0.08,
            max_depth=5,
            random_state=random_seed,
        )

        # Isotonic regression calibrator
        self.calibrator = IsotonicRegression(y_min=0.01, y_max=0.99, out_of_bounds="clip")

        # Bootstrap sub-models for empirical prediction intervals
        self.bootstrap_models: list[HistGradientBoostingClassifier] = []
        self.shift_detector = DistributionShiftDetector()
        self.is_fitted: bool = False

    def fit(
        self,
        x_train: np.ndarray,
        y_train: np.ndarray,
        x_cal: np.ndarray,
        y_cal: np.ndarray,
    ) -> None:
        """Fit base model on x_train, calibrator on held-out x_cal, and bootstrap ensemble."""
        # 1. Fit distribution shift envelope on training support
        self.shift_detector.fit(x_train)

        # 2. Fit base gradient-boosted classifier
        self.base_model.fit(x_train, y_train)

        # 3. Predict uncalibrated probabilities on held-out calibration split
        raw_cal_probs = self.base_model.predict_proba(x_cal)[:, 1]

        # 4. Fit monotonic isotonic calibrator on calibration split
        self.calibrator.fit(raw_cal_probs, y_cal)

        # 5. Fit 5 bootstrap sub-models for epistemic spread estimation
        rng = np.random.default_rng(self.random_seed)
        n_samples = len(x_train)
        self.bootstrap_models = []

        for b_idx in range(5):
            boot_idx = rng.choice(n_samples, size=n_samples, replace=True)
            boot_model = HistGradientBoostingClassifier(
                max_iter=50,
                max_depth=4,
                random_state=self.random_seed + b_idx + 1,
            )
            boot_model.fit(x_train[boot_idx], y_train[boot_idx])
            self.bootstrap_models.append(boot_model)

        self.is_fitted = True

    def predict_edge(
        self,
        feature_vector: np.ndarray,
        feature_summary: dict[str, Any] | None = None,
        temperature: float = 1.0,
    ) -> dict[str, Any]:
        """Output calibrated probability, credible interval, and shift diagnostics.

        Applies temperature scaling: p^(T) = sigmoid(logit(p) / T).
        """
        if not self.is_fitted:
            # Fallback prior before fitting
            return {
                "probability": 0.50,
                "interval": [0.20, 0.80],
                "model_version": self.model_version,
                "is_shifted": False,
                "is_conflicted": False,
                "features": feature_summary or {},
            }

        x_2d = feature_vector.reshape(1, -1)

        # 1. Raw prediction from base model
        raw_prob = float(self.base_model.predict_proba(x_2d)[0, 1])

        # 2. Isotonic calibration
        calibrated_prob = float(self.calibrator.predict([raw_prob])[0])

        # 3. Bootstrap ensemble interval spread
        boot_preds = [float(bm.predict_proba(x_2d)[0, 1]) for bm in self.bootstrap_models]
        lower_bound = max(0.01, float(np.percentile(boot_preds, 10)))
        upper_bound = min(0.99, float(np.percentile(boot_preds, 90)))

        # 4. Check for distribution shift
        is_shifted, shift_reasons = self.shift_detector.detect_shift(feature_vector)
        if is_shifted:
            # Fallback to conservative bound under severe distribution shift
            hazard = feature_summary.get("hazard_intensity", 0.0) if feature_summary else 0.0
            if hazard > 0.25:
                calibrated_prob = min(calibrated_prob, 0.20)
                lower_bound = 0.02
                upper_bound = 0.40

        # 5. Handle conflicting evidence: widen interval
        is_conflicted = False
        if feature_summary:
            is_conflicted = bool(feature_summary.get("is_conflicted", 0.0) == 1.0)
        if is_conflicted:
            lower_bound = min(lower_bound, 0.15)
            upper_bound = max(upper_bound, 0.85)

        # 6. Apply temperature scaling if T != 1.0
        final_prob = calibrated_prob
        if temperature > 0.0 and abs(temperature - 1.0) > 1e-4:
            # Clamped logit
            clipped_p = float(np.clip(calibrated_prob, 0.001, 0.999))
            final_prob = float(expit(logit(clipped_p) / temperature))

        return {
            "probability": round(float(final_prob), 4),
            "interval": [round(float(lower_bound), 3), round(float(upper_bound), 3)],
            "model_version": self.model_version,
            "is_shifted": is_shifted,
            "shift_reasons": shift_reasons if is_shifted else [],
            "is_conflicted": is_conflicted,
            "features": feature_summary or {},
        }
