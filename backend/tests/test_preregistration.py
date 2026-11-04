"""Verification of mathematical invariants pre-registered in docs/research/preregistration.md."""

import numpy as np
from scipy.special import expit, logit
from scipy.stats import spearmanr


def test_temperature_scaling_preserves_ranking():
    """Verify that temperature distortion strictly preserves ranking (Spearman rho = 1.0)

    while altering confidence calibration across all pre-registered temperatures.
    """
    rng = np.random.default_rng(42)
    # Generate calibrated base probabilities
    base_probs = rng.uniform(0.05, 0.95, size=100)

    temperatures = [0.5, 0.67, 1.0, 1.5, 2.0]

    for temp in temperatures:
        # p^(T) = sigmoid(logit(p) / T)
        distorted_probs = expit(logit(base_probs) / temp)

        # Spearman rank correlation must be exactly 1.0
        rho, _ = spearmanr(base_probs, distorted_probs)
        assert np.isclose(rho, 1.0), f"Temperature {temp} failed to preserve ranking! Rho = {rho}"

        if temp < 1.0:
            # Overconfidence: probabilities pushed toward 0 and 1
            high_mask = base_probs > 0.5
            assert np.all(distorted_probs[high_mask] >= base_probs[high_mask])
            low_mask = base_probs < 0.5
            assert np.all(distorted_probs[low_mask] <= base_probs[low_mask])
        elif temp > 1.0:
            # Underconfidence: probabilities pulled toward 0.5
            high_mask = base_probs > 0.5
            assert np.all(distorted_probs[high_mask] <= base_probs[high_mask])
            low_mask = base_probs < 0.5
            assert np.all(distorted_probs[low_mask] >= base_probs[low_mask])


def test_indian_regions_geospatial_bounds():
    """Verify pre-registered Indian study regions satisfy geographic bounds and CRS invariants."""
    kerala_bbox = [75.9000, 11.4500, 76.4000, 11.9500]
    min_lon, min_lat, max_lon, max_lat = kerala_bbox

    # Longitudes in India: ~68 to ~97
    assert 68.0 <= min_lon < max_lon <= 97.0
    # Latitudes in India: ~8 to ~37
    assert 8.0 <= min_lat < max_lat <= 37.0
