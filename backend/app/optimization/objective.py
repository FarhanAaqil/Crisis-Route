"""Deprivation penalty objectives and equity metrics for humanitarian allocation."""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class EquityEvaluation:
    """Quantitative equity, deprivation, and fairness evaluation metrics."""

    total_deprivation_penalty: float
    mean_fulfillment_ratio: float
    min_fulfillment_ratio: float
    vulnerable_group_fulfillment_ratio: float
    alpha_service_floor: float
    alpha_floor_satisfied: bool
    gini_coefficient: float
    unmet_demand_count: int


def get_vulnerability_weight(group_name: str) -> float:
    """Return priority multiplier for sensitive and vulnerable demographic groups."""
    weights = {
        "pediatric_refuge": 2.0,
        "children_hospital": 2.0,
        "elderly_clinic": 1.7,
        "geriatric_home": 1.7,
        "isolated_hamlet": 1.5,
        "flood_evacuation_camp": 1.4,
        "general_population": 1.0,
    }
    return weights.get(group_name.lower().strip(), 1.0)


def compute_deprivation_cost(
    unmet_quantity: int,
    commodity_priority: float = 1.0,
    vulnerability_weight: float = 1.0,
    beta_tail_risk: float = 0.20,
) -> float:
    """Calculate convex deprivation penalty for unserved humanitarian demand.

    L(u) = w * v * (u + beta * u^2)
    Convexity penalizes severe concentrated deficits more heavily than distributed minor deficits.
    """
    if unmet_quantity <= 0:
        return 0.0

    u = float(unmet_quantity)
    convex_penalty = u + (beta_tail_risk * (u**2) / 100.0)
    return float(commodity_priority * vulnerability_weight * convex_penalty)


def compute_gini_coefficient(fractions: list[float]) -> float:
    """Compute Gini inequality index over fulfillment fractions across all demand nodes.

    A Gini coefficient of 0.0 represents perfect equality in fulfillment;
    1.0 represents total concentration where one node receives everything and others nothing.
    """
    if not fractions:
        return 0.0

    n = len(fractions)
    if n == 1:
        return 0.0

    sorted_vals = sorted(fractions)
    total = sum(sorted_vals)
    if total <= 1e-9:
        return 0.0

    cumulative_sum = 0.0
    for i, val in enumerate(sorted_vals, 1):
        cumulative_sum += i * val

    gini = (2.0 * cumulative_sum) / (n * total) - (n + 1.0) / n
    return max(0.0, min(1.0, float(round(gini, 4))))


def evaluate_equity(
    demands: dict[str, dict[str, int]],
    deliveries: dict[str, dict[str, int]],
    vulnerable_groups: dict[str, str],
    commodity_priorities: dict[str, float] | None = None,
    alpha_floor: float = 0.30,
    beta_tail_risk: float = 0.20,
) -> EquityEvaluation:
    """Compute end-to-end fairness, deprivation, and service floor compliance metrics.

    Args:
        demands: node_id -> {commodity_id: required_qty}
        deliveries: node_id -> {commodity_id: delivered_qty}
        vulnerable_groups: node_id -> demographic_group_string
        commodity_priorities: commodity_id -> weight
        alpha_floor: Minimum mandatory fraction for vulnerable groups
        beta_tail_risk: Quadratic deprivation penalty coefficient
    """
    priorities = commodity_priorities or {}
    total_deprivation = 0.0
    fulfillment_ratios: list[float] = []
    vulnerable_ratios: list[float] = []
    unmet_count = 0
    all_floors_met = True

    for node_id, node_demand in demands.items():
        total_node_demand = sum(node_demand.values())
        node_delivery = deliveries.get(node_id, {})
        total_node_delivered = sum(node_delivery.get(cid, 0) for cid in node_demand)

        ratio = total_node_delivered / total_node_demand if total_node_demand > 0 else 1.0
        fulfillment_ratios.append(ratio)

        group = vulnerable_groups.get(node_id, "general_population")
        vuln_w = get_vulnerability_weight(group)
        is_vuln = vuln_w > 1.0

        if is_vuln:
            vulnerable_ratios.append(ratio)
            if ratio < (alpha_floor - 1e-4) and total_node_demand > 0:
                all_floors_met = False

        for cid, req in node_demand.items():
            deliv = node_delivery.get(cid, 0)
            unmet = max(0, req - deliv)
            if unmet > 0:
                unmet_count += 1
                c_prio = priorities.get(cid, 1.0)
                total_deprivation += compute_deprivation_cost(
                    unmet,
                    commodity_priority=c_prio,
                    vulnerability_weight=vuln_w,
                    beta_tail_risk=beta_tail_risk,
                )

    mean_ratio = sum(fulfillment_ratios) / len(fulfillment_ratios) if fulfillment_ratios else 1.0
    min_ratio = min(fulfillment_ratios) if fulfillment_ratios else 1.0
    mean_vuln_ratio = (
        sum(vulnerable_ratios) / len(vulnerable_ratios) if vulnerable_ratios else mean_ratio
    )
    gini = compute_gini_coefficient(fulfillment_ratios)

    return EquityEvaluation(
        total_deprivation_penalty=round(total_deprivation, 2),
        mean_fulfillment_ratio=round(mean_ratio, 4),
        min_fulfillment_ratio=round(min_ratio, 4),
        vulnerable_group_fulfillment_ratio=round(mean_vuln_ratio, 4),
        alpha_service_floor=alpha_floor,
        alpha_floor_satisfied=all_floors_met,
        gini_coefficient=gini,
        unmet_demand_count=unmet_count,
    )


def equity_evaluation_to_dict(evaluation: EquityEvaluation) -> dict[str, Any]:
    """Convert dataclass to standard JSON-serializable dictionary."""
    return {
        "total_deprivation_penalty": evaluation.total_deprivation_penalty,
        "mean_fulfillment_ratio": evaluation.mean_fulfillment_ratio,
        "min_fulfillment_ratio": evaluation.min_fulfillment_ratio,
        "vulnerable_group_fulfillment_ratio": evaluation.vulnerable_group_fulfillment_ratio,
        "alpha_service_floor": evaluation.alpha_service_floor,
        "alpha_floor_satisfied": evaluation.alpha_floor_satisfied,
        "gini_coefficient": evaluation.gini_coefficient,
        "unmet_demand_count": evaluation.unmet_demand_count,
    }
