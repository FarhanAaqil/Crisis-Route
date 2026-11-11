"""Unit tests for correlated Monte Carlo hazard scenario generator."""

import time

import networkx as nx
import numpy as np

from app.api.scenarios import seed_canonical_scenario
from app.graph.build import build_scenario_corridor_graph
from app.optimization.scenarios_sampler import sample_hazard_scenarios


def test_monte_carlo_runtime_exit_criterion_1():
    """Verify Monte Carlo sampler runs S=50 samples in < 5.0 seconds on CPU (Gate Criterion 1)."""
    scenario = seed_canonical_scenario()
    g = build_scenario_corridor_graph(scenario)

    t0 = time.perf_counter()
    bundle = sample_hazard_scenarios(g, num_samples=50, random_seed=42)
    elapsed = time.perf_counter() - t0

    assert elapsed < 5.0, f"Sampler exceeded 5.0s limit: took {elapsed:.3f}s"
    assert bundle.num_samples == 50
    assert bundle.realizations.shape == (50, len(bundle.edge_ids))
    assert 0.0 < bundle.mean_network_passability <= 1.0


def test_spatial_correlation_structure():
    """Verify spatially adjacent edges have positive correlation in passability realizations."""
    g = nx.DiGraph()
    # Three edges: E1 and E2 very close, E3 far away
    g.add_node("A", lon=76.000, lat=11.500)
    g.add_node("B", lon=76.002, lat=11.502)
    g.add_node("C", lon=76.004, lat=11.504)
    g.add_node("FAR1", lon=76.800, lat=11.900)
    g.add_node("FAR2", lon=76.802, lat=11.902)

    g.add_edge("A", "B", edge_id="NEAR_1", passability_prob=0.7)
    g.add_edge("B", "C", edge_id="NEAR_2", passability_prob=0.7)
    g.add_edge("FAR1", "FAR2", edge_id="FAR_3", passability_prob=0.7)

    bundle = sample_hazard_scenarios(g, num_samples=200, length_scale_m=5000.0, random_seed=99)
    # Binary matrix: (200, 3)
    data = bundle.realizations.astype(float)
    corr_matrix = np.corrcoef(data.T)

    # Correlation between NEAR_1 and NEAR_2 should exceed correlation with FAR_3
    corr_near = corr_matrix[0, 1]
    corr_far = corr_matrix[0, 2]

    assert corr_near > corr_far
    assert corr_near > 0.30  # Strong spatial correlation for close links


def test_marginal_passability_calibration():
    """Verify sampled mean matches edge baseline passability within empirical confidence bounds."""
    g = nx.DiGraph()
    g.add_node("X", lon=76.0, lat=11.5)
    g.add_node("Y", lon=76.1, lat=11.5)
    g.add_edge("X", "Y", edge_id="LINK_A", passability_prob=0.85)

    bundle = sample_hazard_scenarios(g, num_samples=500, random_seed=123)
    empirical_p = float(np.mean(bundle.realizations[:, 0]))

    # Target is 0.85, 500 samples standard error is ~ sqrt(0.85*0.15/500) = ~0.016
    assert abs(empirical_p - 0.85) < 0.05


def _grid_graph(side: int):
    """A side x side lattice of short roads, big enough to trigger the large-network sampler."""
    import networkx as nx

    g = nx.DiGraph()
    for i in range(side):
        for j in range(side):
            g.add_node(f"n{i}_{j}", lon=76.0 + i * 0.002, lat=11.5 + j * 0.002)
    k = 0
    for i in range(side):
        for j in range(side):
            for di, dj in ((1, 0), (0, 1)):
                if i + di < side and j + dj < side:
                    g.add_edge(
                        f"n{i}_{j}",
                        f"n{i + di}_{j + dj}",
                        edge_id=f"E{k}",
                        passability_prob=0.8,
                        free_flow_sec=60.0,
                    )
                    k += 1
    return g


def test_large_network_sampler_keeps_marginals_and_spatial_correlation():
    import numpy as np

    from app.optimization.scenarios_sampler import sample_hazard_scenarios

    g = _grid_graph(40)  # 3,120 edges -> random Fourier feature path
    assert g.number_of_edges() > 2500
    bundle = sample_hazard_scenarios(g, num_samples=400, random_seed=7)
    real = bundle.realizations.astype(float)

    # Marginal passability matches the 0.8 target
    assert abs(real.mean() - 0.8) < 0.03

    # Neighbouring edges fail together far more often than distant ones
    near = np.corrcoef(real[:, 0], real[:, 1])[0, 1]
    far = np.corrcoef(real[:, 0], real[:, -1])[0, 1]
    assert near > far + 0.15
