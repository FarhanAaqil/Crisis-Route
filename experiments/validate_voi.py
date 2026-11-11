"""Experiment to validate that VoI rankings correlate positively with simulated regret reduction."""

from dataclasses import dataclass

import numpy as np
from scipy.stats import pearsonr

from experiments.evaluate_hypotheses import (
    _recon_candidates,
    _simulated_regret_reduction,
)


@dataclass
class VoIValidationResult:
    """Statistical summary of VoI correlation against simulated regret reduction."""

    pearson_r: float
    p_value: float
    num_edges_evaluated: int
    meets_criterion: bool


def run_voi_simulation_validation(
    num_edges: int = 30,
    random_seed: int = 42,
) -> VoIValidationResult:
    """Check that analytic EVPI tracks Monte Carlo simulated regret reduction.

    Samples ``num_edges`` route links from the three benchmark corridors, computes each link's
    analytic EVPI, then estimates the minutes saved by perfect information with an independent
    simulation of the commit-or-detour decision. Gate Criterion 3 asks for r > 0.4, p < 0.05.
    """
    rng = np.random.default_rng(random_seed)
    candidates = _recon_candidates()
    picks = rng.choice(
        len(candidates), size=num_edges, replace=len(candidates) < num_edges
    )

    analytic = [candidates[i].evpi_min for i in picks]
    simulated = [_simulated_regret_reduction(candidates[i], rng) for i in picks]

    r_stat, p_val = pearsonr(analytic, simulated)
    r_float = float(round(r_stat, 4))
    p_float = float(round(p_val, 5))

    return VoIValidationResult(
        pearson_r=r_float,
        p_value=p_float,
        num_edges_evaluated=num_edges,
        meets_criterion=bool(r_float > 0.40 and p_float < 0.05),
    )


if __name__ == "__main__":
    result = run_voi_simulation_validation()
    print(
        f"VoI Validation: r = {result.pearson_r:.3f}, p = {result.p_value:.5f}, meets = {result.meets_criterion}"
    )
