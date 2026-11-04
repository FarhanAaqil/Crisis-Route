"""Unit tests for two-stage stochastic recourse allocation model."""

from app.api.scenarios import seed_canonical_scenario
from app.domain.models import DemandNodeModel
from app.graph.build import build_scenario_corridor_graph
from app.optimization.recourse import solve_two_stage_recourse


def test_stochastic_recourse_exit_criterion_2():
    """Verify two-stage recourse model solves to within 5% optimality gap (Gate Criterion 2)."""
    scenario = seed_canonical_scenario().model_copy(deep=True)
    if len(scenario.demand_nodes) < 5:
        scenario.demand_nodes.append(
            DemandNodeModel(
                id="NODE-WAYANAD-RECOURSE-CLINIC",
                name="Wayanad Recourse Relief Clinic",
                vulnerable_group="pediatric_refuge",
                population=160,
                coordinates=[76.11, 11.62],
                demand={"COM-WATER-10L": 80, "COM-MRE-RATIONS": 120},
            )
        )

    g = build_scenario_corridor_graph(scenario)

    result = solve_two_stage_recourse(
        scenario,
        g,
        num_samples=15,
        time_limit_sec=20.0,
        random_seed=42,
    )

    # Gate Criterion 2: <= 5% optimality gap
    assert result.is_within_target_gap is True
    assert result.optimality_gap <= 0.05
    assert result.solve_duration_sec < 30.0
    assert len(result.plan.allocations) > 0
    assert len(result.plan.vehicle_routes) > 0
    assert result.plan.equity_evaluation["alpha_floor_satisfied"] is True
