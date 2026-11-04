"""Unit tests for Value of Information (VoI) ranking and simulation correlation."""

from experiments.validate_voi import run_voi_simulation_validation


def test_voi_simulation_correlation_exit_criterion_3():
    """Verify VoI rankings correlate positively with regret reduction (r > 0.4, p < 0.05)."""
    result = run_voi_simulation_validation(num_edges=30, random_seed=42)

    assert result.meets_criterion is True
    assert result.pearson_r > 0.40, f"Expected r > 0.40, got r = {result.pearson_r}"
    assert result.p_value < 0.05, f"Expected p < 0.05, got p = {result.p_value}"
    assert result.num_edges_evaluated == 30

