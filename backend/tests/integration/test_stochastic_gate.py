"""Gate Verification for Phase 5: Stochastic Extension & Value of Information (VoI).

Explicitly validates all three Method Complete exit criteria:
1. Monte Carlo generator runs S=50 samples in < 5.0 seconds on CPU.
2. Two-stage recourse model solves to within 5% optimality gap.
3. VoI rankings correlate positively with simulated regret reduction (r > 0.4, p < 0.05).
"""

import time

from experiments.validate_voi import run_voi_simulation_validation

from app.api.scenarios import seed_canonical_scenario
from app.graph.build import build_scenario_corridor_graph
from app.optimization.recourse import solve_two_stage_recourse
from app.optimization.scenarios_sampler import sample_hazard_scenarios


def test_phase_5_exit_criterion_1_monte_carlo_speed():
    """Gate 1: Monte Carlo scenario generator runs S=50 samples in < 5 seconds."""
    scenario = seed_canonical_scenario()
    g = build_scenario_corridor_graph(scenario)

    t0 = time.perf_counter()
    bundle = sample_hazard_scenarios(g, num_samples=50, random_seed=42)
    elapsed = time.perf_counter() - t0

    assert elapsed < 5.0, f"Criterion 1 failed: took {elapsed:.2f}s (must be < 5.0s)"
    assert bundle.num_samples == 50
    assert bundle.realizations.shape[0] == 50


def test_phase_5_exit_criterion_2_recourse_optimality_gap():
    """Gate 2: Two-stage recourse model solves to within 5% optimality gap."""
    scenario = seed_canonical_scenario().model_copy(deep=True)
    g = build_scenario_corridor_graph(scenario)

    recourse_result = solve_two_stage_recourse(
        scenario,
        g,
        num_samples=15,
        time_limit_sec=25.0,
        random_seed=42,
    )

    assert recourse_result.is_within_target_gap is True
    assert recourse_result.optimality_gap <= 0.05, (
        f"Criterion 2 failed: optimality gap was {recourse_result.optimality_gap:.4f} (> 0.05)"
    )


def test_phase_5_exit_criterion_3_voi_correlation():
    """Gate 3: VoI rankings correlate positively with simulated regret reduction."""
    voi_result = run_voi_simulation_validation(num_edges=30, random_seed=42)

    assert voi_result.meets_criterion is True
    assert voi_result.pearson_r > 0.40, (
        f"Criterion 3 failed: r = {voi_result.pearson_r:.3f} (must be > 0.40)"
    )
    assert voi_result.p_value < 0.05, (
        f"Criterion 3 failed: p = {voi_result.p_value:.5f} (must be < 0.05)"
    )
