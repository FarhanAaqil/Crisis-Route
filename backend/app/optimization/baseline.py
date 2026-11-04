"""Proportional greedy allocation baseline running on nominal shortest paths."""

from typing import Any

import networkx as nx

from app.domain.models import (
    AllocationItem,
    ScenarioDetail,
    UnmetDemandItem,
    VehicleRoutePlan,
)
from app.graph.routing import find_shortest_path
from app.optimization.objective import evaluate_equity


def solve_proportional_baseline(
    scenario: ScenarioDetail,
    g: nx.DiGraph,
) -> dict[str, Any]:
    """Execute heuristic greedy allocation on nominal shortest paths.

    1. Computes nominal shortest path from each depot to each demand node.
    2. Sorts depot-demand pairs by nominal travel time ascending.
    3. Greedily allocates available depot stock and vehicle capacity.
    4. Evaluates resulting equity, deprivation loss, and unmet demand.
    """
    depot_stock: dict[str, dict[str, int]] = {d.id: dict(d.inventory) for d in scenario.depots}
    demand_remaining: dict[str, dict[str, int]] = {
        n.id: dict(n.demand) for n in scenario.demand_nodes
    }
    vehicle_capacity_remaining: dict[str, float] = {
        v.id: float(v.capacity_kg) for v in scenario.vehicles
    }
    vehicle_depot_map: dict[str, str] = {v.id: v.depot_id for v in scenario.vehicles}
    commodity_weight_map: dict[str, float] = {
        c.id: float(c.unit_weight_kg) for c in scenario.commodities
    }

    # Find shortest paths from depots to demand nodes
    routes_by_pair: dict[tuple[str, str], tuple[list[str], float, float]] = {}
    pair_times: list[tuple[float, str, str]] = []

    for depot in scenario.depots:
        for node in scenario.demand_nodes:
            if depot.id in g and node.id in g:
                try:
                    _, edge_path, travel_time_sec, survival_p = find_shortest_path(
                        g, depot.id, node.id, weight_mode="free_flow"
                    )
                    routes_by_pair[(depot.id, node.id)] = (
                        edge_path,
                        travel_time_sec / 60.0,
                        survival_p,
                    )
                    pair_times.append((travel_time_sec, depot.id, node.id))
                except (ValueError, nx.NetworkXNoPath):
                    continue

    pair_times.sort(key=lambda item: item[0])

    allocations: list[AllocationItem] = []
    deliveries_by_node: dict[str, dict[str, int]] = {n.id: {} for n in scenario.demand_nodes}
    active_vehicle_paths: dict[str, list[str]] = {}
    vehicle_metrics: dict[str, tuple[float, float]] = {}

    # Greedy allocation
    for _, depot_id, node_id in pair_times:
        edge_path, t_min, p_surv = routes_by_pair[(depot_id, node_id)]
        # Find available vehicles for this depot
        available_vehicles = [
            v_id
            for v_id, d_id in vehicle_depot_map.items()
            if d_id == depot_id and vehicle_capacity_remaining[v_id] > 0
        ]
        if not available_vehicles:
            continue

        for v_id in available_vehicles:
            for cid, needed in list(demand_remaining[node_id].items()):
                if needed <= 0:
                    continue
                in_stock = depot_stock[depot_id].get(cid, 0)
                if in_stock <= 0:
                    continue

                unit_weight = commodity_weight_map.get(cid, 1.0)
                max_by_weight = int(vehicle_capacity_remaining[v_id] // unit_weight)
                alloc_qty = min(needed, in_stock, max_by_weight)

                if alloc_qty > 0:
                    depot_stock[depot_id][cid] -= alloc_qty
                    demand_remaining[node_id][cid] -= alloc_qty
                    vehicle_capacity_remaining[v_id] -= alloc_qty * unit_weight

                    allocations.append(
                        AllocationItem(
                            demand_node_id=node_id,
                            commodity_id=cid,
                            vehicle_id=v_id,
                            quantity_delivered=alloc_qty,
                        )
                    )
                    current_node_deliv = deliveries_by_node[node_id]
                    current_node_deliv[cid] = current_node_deliv.get(cid, 0) + alloc_qty

                    active_vehicle_paths[v_id] = edge_path
                    vehicle_metrics[v_id] = (t_min, p_surv)

    # Build vehicle route plans
    vehicle_routes: list[VehicleRoutePlan] = []
    for v_id, path in active_vehicle_paths.items():
        t_min, p_surv = vehicle_metrics[v_id]
        vehicle_routes.append(
            VehicleRoutePlan(
                vehicle_id=v_id,
                chosen_path=path,
                survival_probability=round(p_surv, 4),
                estimated_travel_time_min=round(t_min, 2),
                alternative_paths=[],
            )
        )

    # Compute unmet demand
    unmet_demands: list[UnmetDemandItem] = []
    vulnerable_groups_map: dict[str, str] = {
        n.id: n.vulnerable_group for n in scenario.demand_nodes
    }
    for n in scenario.demand_nodes:
        for cid, needed in demand_remaining[n.id].items():
            if needed > 0:
                unmet_demands.append(
                    UnmetDemandItem(
                        demand_node_id=n.id,
                        commodity_id=cid,
                        unmet_quantity=needed,
                        vulnerable_group=n.vulnerable_group,
                    )
                )

    demands_dict = {n.id: dict(n.demand) for n in scenario.demand_nodes}
    priorities = {c.id: float(c.priority_weight) for c in scenario.commodities}

    equity = evaluate_equity(
        demands=demands_dict,
        deliveries=deliveries_by_node,
        vulnerable_groups=vulnerable_groups_map,
        commodity_priorities=priorities,
        alpha_floor=scenario.equity_parameters.min_group_service_floor_alpha,
        beta_tail_risk=scenario.equity_parameters.beta_tail_risk_weight,
    )

    return {
        "allocations": allocations,
        "vehicle_routes": vehicle_routes,
        "unmet_demands": unmet_demands,
        "equity": equity,
    }
