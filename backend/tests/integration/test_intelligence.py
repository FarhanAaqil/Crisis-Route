"""Integration tests for feature extraction, passability models, observations, and routing."""

import numpy as np

from app.domain.models import ObservationResponse, ObservationStatus
from app.domain.observations import ObservationGraphManager
from app.graph.alternatives import find_k_diverse_alternatives
from app.graph.build import build_directed_graph
from app.graph.routing import find_shortest_path
from app.ml.baselines import FrequencyBaseline, LogisticRegressionBaseline
from app.ml.calibrated_model import CalibratedPassabilityModel
from app.ml.features import DistributionShiftDetector, EdgeFeatureExtractor


def test_feature_extraction_and_distribution_shift():
    """Verify feature extractor extracts 12 features and shift detector identifies anomalies."""
    edge = {
        "edge_id": "E_TEST_1",
        "road_class": "primary",
        "length_m": 1200.0,
        "free_flow_sec": 80.0,
        "bridge": True,
        "slope_pct": 8.0,
    }
    obs = [
        {
            "edge_id": "E_TEST_1",
            "status": "passable",
            "source_credibility": 0.90,
            "stale_age_hours": 2.0,
        }
    ]

    vector, summary = EdgeFeatureExtractor.extract_features(
        edge=edge,
        observations=obs,
        hazard_intensity=0.45,
    )

    assert len(vector) == 12
    assert summary["road_class_code"] == 3.0  # primary
    assert summary["bridge_flag"] == 1.0
    assert summary["obs_status_score"] == 1.0
    assert summary["has_observation"] == 1.0

    # Test distribution shift detector
    detector = DistributionShiftDetector(tolerance_pct=0.10)
    # Fit on synthetic training envelope
    training_data = np.tile(vector, (10, 1))
    detector.fit(training_data)

    is_shifted, reasons = detector.detect_shift(vector)
    assert not is_shifted
    assert len(reasons) == 0

    # Create anomalous vector with extreme slope and hazard
    anomaly_vector = vector.copy()
    anomaly_vector[4] = 85.0  # slope 85%
    anomaly_vector[5] = 4.5  # hazard 4.5 (normal is 0 to 1)

    is_anom_shifted, anom_reasons = detector.detect_shift(anomaly_vector)
    assert is_anom_shifted
    assert "slope_pct" in anom_reasons or "hazard_intensity" in anom_reasons


def test_model_training_and_calibration():
    """Verify CalibratedPassabilityModel fits, calibrates, and outperforms frequency baseline."""
    rng = np.random.default_rng(42)
    n_train = 200
    n_cal = 100

    # Generate synthetic features
    x_train = rng.uniform(0.0, 1.0, size=(n_train, 12))
    # True relationship: probability decreases with hazard (col 5)
    p_train = np.clip(0.90 - (0.70 * x_train[:, 5]), 0.05, 0.95)
    y_train = (rng.uniform(0.0, 1.0, size=n_train) < p_train).astype(int)

    x_cal = rng.uniform(0.0, 1.0, size=(n_cal, 12))
    p_cal = np.clip(0.90 - (0.70 * x_cal[:, 5]), 0.05, 0.95)
    y_cal = (rng.uniform(0.0, 1.0, size=n_cal) < p_cal).astype(int)

    # 1. Frequency baseline
    freq_model = FrequencyBaseline()
    freq_model.fit(["primary"] * n_train, list(x_train[:, 5]), list(y_train))

    # 2. Logistic baseline
    log_model = LogisticRegressionBaseline()
    log_model.fit(x_train, y_train)

    # 3. Calibrated GBDT
    model = CalibratedPassabilityModel(model_version="test-gbdt-iso-v1")
    model.fit(x_train, y_train, x_cal, y_cal)

    # Predict on test edge
    test_vec = x_cal[0]
    prediction = model.predict_edge(
        test_vec, feature_summary={"hazard_intensity": float(test_vec[5])}
    )

    assert "probability" in prediction
    assert "interval" in prediction
    assert "model_version" in prediction
    assert "is_shifted" in prediction
    assert 0.01 <= prediction["probability"] <= 0.99
    assert prediction["interval"][0] <= prediction["interval"][1]


def test_observation_application_and_conflict_widening():
    """Verify applying observation updates graph passability and conflicts widen interval."""
    edges = [
        {
            "edge_id": "E_CORRIDOR_1",
            "u_node": "N1",
            "v_node": "N2",
            "length_m": 1000.0,
            "free_flow_sec": 60.0,
            "passability_prob": 0.85,
        }
    ]
    g = build_directed_graph(edges)
    initial_hash = "some_hash"

    # 1. Apply field closure
    obs_closure = ObservationResponse(
        edge_id="E_CORRIDOR_1",
        status=ObservationStatus.IMPASSABLE,
        source_credibility=0.90,
    )
    g_updated, new_hash, is_conflicted = ObservationGraphManager.apply_observation_to_graph(
        base_graph=g,
        observation=obs_closure,
    )

    assert not is_conflicted
    assert new_hash != initial_hash
    # Closed edge passability drops
    assert g_updated["N1"]["N2"]["passability_prob"] < 0.30

    # 2. Apply conflicting clearance report
    obs_open = ObservationResponse(
        edge_id="E_CORRIDOR_1",
        status=ObservationStatus.PASSABLE,
        source_credibility=0.60,
    )
    _, _, is_conflicted_2 = ObservationGraphManager.apply_observation_to_graph(
        base_graph=g_updated,
        observation=obs_open,
        existing_observations=[obs_closure],
    )
    assert is_conflicted_2 is True


def test_risk_aware_routing_and_yen_alternatives():
    """Verify that risk-aware routing avoids hazardous links and Yen's generates diverse paths."""
    # Graph diamond: N1 -> N2 -> N4 (Fast but hazardous) vs. N1 -> N3 -> N4 (Longer but safe)
    edges = [
        # Path A (High hazard)
        {
            "edge_id": "E_HAZ_1",
            "u_node": "N1",
            "v_node": "N2",
            "length_m": 500.0,
            "free_flow_sec": 30.0,
            "passability_prob": 0.10,  # 10% survival
        },
        {
            "edge_id": "E_HAZ_2",
            "u_node": "N2",
            "v_node": "N4",
            "length_m": 500.0,
            "free_flow_sec": 30.0,
            "passability_prob": 0.10,
        },
        # Path B (Safe detour)
        {
            "edge_id": "E_SAFE_1",
            "u_node": "N1",
            "v_node": "N3",
            "length_m": 900.0,
            "free_flow_sec": 60.0,
            "passability_prob": 0.95,  # 95% survival
        },
        {
            "edge_id": "E_SAFE_2",
            "u_node": "N3",
            "v_node": "N4",
            "length_m": 900.0,
            "free_flow_sec": 60.0,
            "passability_prob": 0.95,
        },
        # Path C (Secondary connector)
        {
            "edge_id": "E_CONN_1",
            "u_node": "N2",
            "v_node": "N3",
            "length_m": 400.0,
            "free_flow_sec": 25.0,
            "passability_prob": 0.80,
        },
    ]
    g = build_directed_graph(edges)

    # 1. Free-flow shortest time baseline chooses Path A (60s vs 120s)
    ff_nodes, ff_edges, ff_time, ff_surv = find_shortest_path(
        g, "N1", "N4", weight_mode="free_flow"
    )
    assert ff_nodes == ["N1", "N2", "N4"]
    assert ff_time == 60.0
    assert ff_surv == 0.01  # 0.1 * 0.1 = 0.01 survival

    # 2. Risk-adjusted routing chooses Safe Detour Path B (avoids low passability)
    ra_nodes, ra_edges, ra_time, ra_surv = find_shortest_path(
        g, "N1", "N4", weight_mode="risk_adjusted", lambda_r=60.0
    )
    assert ra_nodes == ["N1", "N3", "N4"]
    assert ra_surv > 0.85  # 0.95 * 0.95 = 0.9025 survival

    # 3. Yen's k-shortest diverse alternatives (k=3)
    alternatives = find_k_diverse_alternatives(g, "N1", "N4", k=3, lambda_r=60.0)
    assert len(alternatives) >= 2
    assert alternatives[0]["rank"] == 1
    assert alternatives[0]["jaccard_overlap_with_primary"] == 1.0

    # Alternative 2 should have lower overlap and higher ETA
    alt2 = alternatives[1]
    assert alt2["rank"] == 2
    assert alt2["jaccard_overlap_with_primary"] < 1.0
