"""Calibration and verification metrics: Brier score, ECE, and reliability diagrams."""

from typing import Any

import numpy as np
from sklearn.metrics import brier_score_loss, roc_auc_score


def compute_calibration_metrics(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    n_bins: int = 10,
) -> dict[str, Any]:
    """Calculate Brier score, Expected Calibration Error (ECE), ROC-AUC, and bin diagrams.

    Uses 10 equal-width bins over [0, 1].
    """
    y_true = np.asarray(y_true, dtype=np.int32)
    y_prob = np.asarray(y_prob, dtype=np.float64)

    # Brier Score & ROC-AUC
    brier = float(brier_score_loss(y_true, y_prob))
    try:
        auc = float(roc_auc_score(y_true, y_prob))
    except ValueError:
        auc = 0.50

    # Expected Calibration Error (ECE)
    bin_edges = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    reliability_diagram: list[dict[str, Any]] = []

    total_samples = len(y_true)

    for m in range(n_bins):
        low, high = bin_edges[m], bin_edges[m + 1]
        if m == n_bins - 1:
            mask = (y_prob >= low) & (y_prob <= high)
        else:
            mask = (y_prob >= low) & (y_prob < high)

        bin_count = int(np.sum(mask))
        if bin_count > 0:
            bin_conf = float(np.mean(y_prob[mask]))
            bin_acc = float(np.mean(y_true[mask]))
            bin_weight = bin_count / total_samples
            ece += bin_weight * abs(bin_acc - bin_conf)

            reliability_diagram.append(
                {
                    "bin_index": m,
                    "bin_range": [round(low, 2), round(high, 2)],
                    "confidence": round(bin_conf, 4),
                    "accuracy": round(bin_acc, 4),
                    "count": bin_count,
                    "calibration_gap": round(bin_acc - bin_conf, 4),
                }
            )
        else:
            reliability_diagram.append(
                {
                    "bin_index": m,
                    "bin_range": [round(low, 2), round(high, 2)],
                    "confidence": round((low + high) / 2.0, 4),
                    "accuracy": 0.0,
                    "count": 0,
                    "calibration_gap": 0.0,
                }
            )

    return {
        "brier_score": round(brier, 4),
        "expected_calibration_error": round(float(ece), 4),
        "roc_auc": round(auc, 4),
        "total_samples": total_samples,
        "reliability_diagram": reliability_diagram,
    }
