"""Evaluate a plan against sampled hazard realizations to measure its real downside risk."""

from dataclasses import dataclass

import numpy as np

from app.domain.models import PlanResponse, ScenarioDetail
from app.optimization.objective import evaluate_equity
from app.optimization.scenarios_sampler import ScenarioSampleBundle


@dataclass(frozen=True)
class PlanRiskProfile:
    """Distribution of deprivation loss for one plan across hazard samples."""

    losses: list[float]

    @property
    def expected_loss(self) -> float:
        return float(np.mean(self.losses)) if self.losses else 0.0

    def expected_shortfall(self, tail: float = 0.05) -> float:
        """Mean of the worst ``tail`` fraction of samples (CVaR)."""
        if not self.losses:
            return 0.0
        ordered = sorted(self.losses, reverse=True)
        k = max(1, int(np.ceil(tail * len(ordered))))
        return float(np.mean(ordered[:k]))


def evaluate_plan_under_samples(
    scenario: ScenarioDetail,
    plan: PlanResponse,
    bundle: ScenarioSampleBundle,
) -> PlanRiskProfile:
    """Deprivation loss of ``plan`` in each sampled world.

    A delivery only arrives when every edge on its trip is passable in that sample; goods on a
    severed trip count as unmet demand.
    """
    edge_idx = {eid: i for i, eid in enumerate(bundle.edge_ids)}
    trip_edges: dict[tuple[str, str], list[str]] = {
        (r.vehicle_id, r.destination_node_id or ""): r.chosen_path for r in plan.vehicle_routes
    }
    demands = {n.id: dict(n.demand) for n in scenario.demand_nodes}
    groups = {n.id: n.vulnerable_group for n in scenario.demand_nodes}
    priorities = {c.id: float(c.priority_weight) for c in scenario.commodities}
    beta = scenario.equity_parameters.beta_tail_risk_weight
    alpha = scenario.equity_parameters.min_group_service_floor_alpha

    losses: list[float] = []
    for s in range(bundle.num_samples):
        realization = bundle.realizations[s]
        trip_open = {
            key: all(realization[edge_idx[e]] for e in path if e in edge_idx)
            for key, path in trip_edges.items()
        }
        delivered: dict[str, dict[str, int]] = {nid: {} for nid in demands}
        for item in plan.allocations:
            if trip_open.get((item.vehicle_id, item.demand_node_id), True):
                node = delivered[item.demand_node_id]
                node[item.commodity_id] = node.get(item.commodity_id, 0) + item.quantity_delivered
        equity = evaluate_equity(
            demands=demands,
            deliveries=delivered,
            vulnerable_groups=groups,
            commodity_priorities=priorities,
            alpha_floor=alpha,
            beta_tail_risk=beta,
        )
        losses.append(equity.total_deprivation_penalty)
    return PlanRiskProfile(losses=losses)
