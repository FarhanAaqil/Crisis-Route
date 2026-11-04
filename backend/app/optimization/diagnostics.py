"""Diagnostic analysis, Minimal Infeasible Subsystem (IIS) detection, and solver explanation."""

from dataclasses import dataclass
from typing import Any

import networkx as nx

from app.domain.models import ScenarioDetail


@dataclass
class InfeasibilityDiagnostic:
    """Actionable diagnostic report explaining why an allocation problem cannot be solved."""

    is_feasible: bool
    primary_cause: str | None
    explanations: list[str]
    remediation_suggestions: list[str]
    isolated_demand_nodes: list[str]
    commodity_deficits: dict[str, int]
    capacity_deficit_kg: float


def diagnose_scenario_feasibility(
    scenario: ScenarioDetail,
    g: nx.DiGraph | None = None,
) -> InfeasibilityDiagnostic:
    """Pre-flight and post-infeasibility diagnostic check.

    Identifies exact physical or operational bottlenecks:
    - Global commodity stock deficits
    - Total fleet weight capacity bottlenecks
    - Network reachability / isolated demand clusters
    - Protected vulnerable group service floor violations
    """
    explanations: list[str] = []
    remediations: list[str] = []
    commodity_deficits: dict[str, int] = {}
    isolated_nodes: list[str] = []

    # 1. Commodity Stock Check
    total_stock: dict[str, int] = {}
    for depot in scenario.depots:
        for cid, qty in depot.inventory.items():
            total_stock[cid] = total_stock.get(cid, 0) + qty

    total_demand: dict[str, int] = {}
    for node in scenario.demand_nodes:
        for cid, qty in node.demand.items():
            total_demand[cid] = total_demand.get(cid, 0) + qty

    for cid, req in total_demand.items():
        avail = total_stock.get(cid, 0)
        if req > avail:
            deficit = req - avail
            commodity_deficits[cid] = deficit
            explanations.append(
                f"Demand for commodity '{cid}' ({req} units) exceeds total stock across "
                f"all depots ({avail} units) by {deficit} units."
            )
            remediations.append(
                f"Increase depot inventory for '{cid}' by at least {deficit} units, "
                f"or adjust demand quotas."
            )

    # 2. Fleet Payload Capacity Check
    commodity_weights = {c.id: c.unit_weight_kg for c in scenario.commodities}
    total_demand_weight = sum(
        qty * commodity_weights.get(cid, 1.0)
        for node in scenario.demand_nodes
        for cid, qty in node.demand.items()
    )
    total_fleet_capacity = sum(v.capacity_kg for v in scenario.vehicles)
    capacity_deficit = max(0.0, total_demand_weight - total_fleet_capacity)

    if capacity_deficit > 0:
        explanations.append(
            f"Total payload required ({total_demand_weight:.1f} kg) exceeds total fleet "
            f"capacity ({total_fleet_capacity:.1f} kg) by {capacity_deficit:.1f} kg."
        )
        remediations.append(
            f"Deploy additional transport vehicles with at least {capacity_deficit:.1f} kg "
            f"aggregate capacity."
        )

    # 3. Network Reachability / Isolated Nodes
    if g is not None:
        depot_ids = {d.id for d in scenario.depots if d.id in g}
        for node in scenario.demand_nodes:
            if node.id not in g:
                isolated_nodes.append(node.id)
                explanations.append(
                    f"Demand node '{node.id}' ({node.name}) is missing from the active network."
                )
                continue

            reachable = any(nx.has_path(g, d_id, node.id) for d_id in depot_ids)
            if not reachable:
                isolated_nodes.append(node.id)
                explanations.append(
                    f"Demand node '{node.id}' ({node.name}) is physically unreachable from "
                    f"all active depots due to road closures or disconnected network components."
                )

        if isolated_nodes:
            remediations.append(
                f"Dispatch engineering reconnaissance to verify alternate access corridors "
                f"for isolated nodes: {', '.join(isolated_nodes)}."
            )

    # 4. Vulnerable Group Service Floor Alpha Feasibility
    alpha = scenario.equity_parameters.min_group_service_floor_alpha
    if alpha > 0.0:
        for node in scenario.demand_nodes:
            if node.vulnerable_group.lower() != "general_population":
                for cid, req in node.demand.items():
                    floor_req = int(req * alpha)
                    avail_stock = total_stock.get(cid, 0)
                    if floor_req > avail_stock:
                        explanations.append(
                            f"Mandatory equity floor (alpha={alpha:.0%}) for vulnerable node "
                            f"'{node.id}' requires at least {floor_req} units of '{cid}', "
                            f"but total network stock is only {avail_stock}."
                        )

    is_feasible = len(explanations) == 0
    primary_cause = explanations[0] if explanations else None

    return InfeasibilityDiagnostic(
        is_feasible=is_feasible,
        primary_cause=primary_cause,
        explanations=explanations,
        remediation_suggestions=remediations,
        isolated_demand_nodes=isolated_nodes,
        commodity_deficits=commodity_deficits,
        capacity_deficit_kg=round(capacity_deficit, 2),
    )


def format_infeasibility_message(diagnostic: InfeasibilityDiagnostic) -> dict[str, Any]:
    """Format diagnostic findings into structured API response payload."""
    return {
        "status": "INFEASIBLE",
        "primary_cause": diagnostic.primary_cause,
        "detail": (
            "; ".join(diagnostic.explanations)
            if diagnostic.explanations
            else "Allocation model is mathematically infeasible under current constraints."
        ),
        "explanations": diagnostic.explanations,
        "remediation_suggestions": diagnostic.remediation_suggestions,
        "isolated_demand_nodes": diagnostic.isolated_demand_nodes,
        "commodity_deficits": diagnostic.commodity_deficits,
        "capacity_deficit_kg": diagnostic.capacity_deficit_kg,
    }
