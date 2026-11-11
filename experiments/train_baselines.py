"""Training runner comparing Frequency Baseline, Logistic Regression, and Calibrated GBDT."""

import json
from pathlib import Path
from typing import Any

import numpy as np
from app.ml.baselines import FrequencyBaseline, LogisticRegressionBaseline
from app.ml.calibrated_model import CalibratedPassabilityModel
from app.ml.registry import model_registry

from experiments.calibrate import compute_calibration_metrics
from experiments.splits import load_split_data


def run_model_comparison(
    splits: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Train all three models on train/cal splits and evaluate calibration metrics on validation split."""
    data = splits or load_split_data()

    x_train = data["train"]["X"]
    y_train = data["train"]["y"]
    train_rc = data["train"]["road_classes"]
    train_h = data["train"]["hazards"]

    x_val = data["val"]["X"]
    y_val = data["val"]["y"]
    val_rc = data["val"]["road_classes"]
    val_h = data["val"]["hazards"]

    # 1. Frequency Baseline
    freq_model = FrequencyBaseline()
    freq_model.fit(train_rc, train_h, y_train)
    freq_val_preds = np.array(
        [freq_model.predict_proba(rc, h) for rc, h in zip(val_rc, val_h, strict=False)]
    )
    freq_metrics = compute_calibration_metrics(y_val, freq_val_preds)

    # 2. Logistic Regression Baseline
    log_model = LogisticRegressionBaseline()
    log_model.fit(x_train, y_train)
    log_val_preds = np.array([log_model.predict_proba(vec) for vec in x_val])
    log_metrics = compute_calibration_metrics(y_val, log_val_preds)

    # 3. Calibrated GBDT + Isotonic Model
    # Partition x_val into 50% for isotonic calibration fitting and 50% for clean validation metrics
    n_val = len(x_val)
    mid = n_val // 2
    x_cal, y_cal = x_val[:mid], y_val[:mid]
    x_val_eval, y_val_eval = x_val[mid:], y_val[mid:]

    gbdt_model = CalibratedPassabilityModel()
    gbdt_model.fit(x_train, y_train, x_cal, y_cal)

    gbdt_val_preds = np.array(
        [gbdt_model.predict_edge(vec)["probability"] for vec in x_val_eval]
    )
    gbdt_metrics = compute_calibration_metrics(y_val_eval, gbdt_val_preds)

    # Register the calibrated model into ModelRegistry
    model_registry.register_model(
        model=gbdt_model,
        metrics={
            k: float(v) for k, v in gbdt_metrics.items() if isinstance(v, int | float)
        },
        training_samples=len(x_train),
    )

    return {
        "frequency_baseline": freq_metrics,
        "logistic_baseline": log_metrics,
        "calibrated_gbdt": gbdt_metrics,
        "model_version": gbdt_model.model_version,
        "training_samples": len(x_train),
        "h1_pass": bool(gbdt_metrics["brier_score"] < freq_metrics["brier_score"]),
    }


def write_calibration_report(
    results: dict[str, Any], out_dir: Path | None = None
) -> Path:
    """Persist the held-out calibration metrics the API serves on the passability screen."""
    target = (out_dir or Path("reports")) / "model_calibration.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "model_version": results["model_version"],
        "model_type": "Gradient-Boosted Trees + Isotonic Post-Hoc Calibrator",
        "evaluation": "held-out half of the event-grouped validation split (CrisisBench-mini)",
        "training_samples": results["training_samples"],
        **results["calibrated_gbdt"],
        "baselines": {
            "frequency": results["frequency_baseline"],
            "logistic": results["logistic_baseline"],
        },
    }
    target.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return target


if __name__ == "__main__":
    results = run_model_comparison()
    print("Wrote", write_calibration_report(results))
    print("Model Comparison Results on Validation Split:")
    print("Frequency Baseline Brier:", results["frequency_baseline"]["brier_score"])
    print("Calibrated GBDT Brier:   ", results["calibrated_gbdt"]["brier_score"])
    print("H1 Hypothesis Pass:     ", results["h1_pass"])
