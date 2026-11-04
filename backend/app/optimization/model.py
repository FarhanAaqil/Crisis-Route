"""Robust humanitarian relief allocation using Google OR-Tools CP-SAT solver."""

import math
import time
from typing import Any
from uuid import uuid4

import networkx as nx
from ortools.sat.python import cp_model

from app.domain.models import (
    AllocationItem,
    ApprovalRecord,
    ApprovalStatus,
    PlanResponse,
    ReconnaissanceRecommendation,
    ScenarioDetail,
    SolverStatus,
    UnmetDemandItem,
    VehicleRoutePlan,
)
from app.graph.routing import find_shortest_path
from app.optimization.diagnostics import diagnose_scenario_feasibility, format_infeasibility_message
from app.optimization.objective import (
    equity_evaluation_to_dict,
    evaluate_equity,
    get_vulnerability_weight,
)


def solve_equitable_allocation(
    scenario: ScenarioDetail,
    g: nx.DiGraph,
) -> tuple[PlanResponse | None, dict[str, Any] | None]:
    """Formulate and solve equitable multi-commodity humanitarian distribution with CP-SAT.

    Returns:
        (PlanResponse, None) if feasible/optimal.
        (None, diagnostic_dict) if mathematically or physically infeasible.
    """
    start_time = time.perf_counter()

    # Pre-flight diagnostic check
    diagnostic = diagnose_scenario_feasibility(scenario, g)
    # If severe structural issues like stock deficit or isolated nodes exist:
    if not diagnostic.is_feasible:
        # Check if alpha floor is the only violation, or if hard constraints fail
        if diagnostic.commodity_deficits or diagnostic.isolated_demand_nodes:
            return None, format_infeasibility_message(diagnostic)

    model = cp_model.CpModel()

    depots = scenario.depots
    demand_nodes = scenario.demand_nodes
    vehicles = scenario.vehicles
    commodities = scenario.commodities
    alpha_floor = scenario.equity_parameters.min_group_service_floor_alpha
    time_limit_sec = float(scenario.solver_parameters.time_limit_seconds)

    commodity_weights = {c.id: int(math.ceil(c.unit_weight_kg)) for c in commodities}
    commodity_priorities = {c.id: float(c.priority_weight) for c in commodities}

    # Precompute risk-aware paths and costs between all depot-demand pairs
    pair_paths: dict[tuple[str, str], tuple[list[str], float, float]] = {}
    for d in depots:
        for n in demand_nodes:
            if d.id in g and n.id in g:
                try:
                    _, edge_path, travel_sec, p_surv = find_shortest_path(
                        g, d.id, n.id, weight_mode="risk_adjusted", lambda_r=60.0
                    )
                    pair_paths[(d.id, n.id)] = (edge_path, travel_sec / 60.0, p_surv)
                except (ValueError, nx.NetworkXNoPath):
                    continue

    # Variable Maps
    # x[d_id, n_id, c_id, v_id] -> delivery quantity
    x_vars: dict[tuple[str, str, str, str], cp_model.IntVar] = {}
    # y[d_id, n_id, v_id] -> vehicle dispatch binary indicator
    y_vars: dict[tuple[str, str, str], cp_model.IntVar] = {}
    # u[n_id, c_id] -> unmet demand slack
    u_vars: dict[tuple[str, str], cp_model.IntVar] = {}

    for n in demand_nodes:
        for c in commodities:
            req = n.demand.get(c.id, 0)
            u_vars[(n.id, c.id)] = model.new_int_var(0, req, f"u_{n.id}_{c.id}")

    for d in depots:
        for n in demand_nodes:
            has_route = (d.id, n.id) in pair_paths
            for v in vehicles:
                # Vehicle must be stationed at depot d
                if v.depot_id != d.id:
                    continue

                if has_route:
                    y_vars[(d.id, n.id, v.id)] = model.new_bool_var(f"y_{d.id}_{n.id}_{v.id}")
                for c in commodities:
                    max_alloc = min(d.inventory.get(c.id, 0), n.demand.get(c.id, 0))
                    if has_route and max_alloc > 0:
                        x_vars[(d.id, n.id, c.id, v.id)] = model.new_int_var(
                            0, max_alloc, f"x_{d.id}_{n.id}_{c.id}_{v.id}"
                        )

    # 1. Depot Inventory Limits
    for d in depots:
        for c in commodities:
            depot_stock = d.inventory.get(c.id, 0)
            relevant_x = [
                var for (dep_id, _, cid, _), var in x_vars.items() if dep_id == d.id and cid == c.id
            ]
            if relevant_x:
                model.add(sum(relevant_x) <= depot_stock)

    # 2. Demand Balance
    for n in demand_nodes:
        for c in commodities:
            req = n.demand.get(c.id, 0)
            relevant_x = [
                var
                for (_, node_id, cid, _), var in x_vars.items()
                if node_id == n.id and cid == c.id
            ]
            model.add(sum(relevant_x) + u_vars[(n.id, c.id)] == req)

    # 3. Vehicle Capacity and Trip Linking
    for (d_id, n_id, v_id), y_var in y_vars.items():
        veh = next(v for v in vehicles if v.id == v_id)
        veh_cap = int(veh.capacity_kg)

        trip_payload_terms = [
            commodity_weights.get(c.id, 1) * x_vars[(d_id, n_id, c.id, v_id)]
            for c in commodities
            if (d_id, n_id, c.id, v_id) in x_vars
        ]
        if trip_payload_terms:
            model.add(sum(trip_payload_terms) <= veh_cap * y_var)

    # 4. Vehicle Time Horizon Limits
    max_minutes = int(scenario.time_horizon_hours * 60)
    for v in vehicles:
        assigned_y = [
            int(pair_paths[(d_id, n_id)][1]) * y_var
            for (d_id, n_id, v_id), y_var in y_vars.items()
            if v_id == v.id and (d_id, n_id) in pair_paths
        ]
        if assigned_y:
            model.add(sum(assigned_y) <= max_minutes)

    # 5. Protected Vulnerable Group Alpha Service Floor
    if alpha_floor > 0.0:
        for n in demand_nodes:
            if n.vulnerable_group.lower() != "general_population":
                total_dem = sum(n.demand.values())
                floor_target = int(math.floor(alpha_floor * total_dem))
                node_deliveries = [
                    var for (_, node_id, _, _), var in x_vars.items() if node_id == n.id
                ]
                if node_deliveries and floor_target > 0:
                    model.add(sum(node_deliveries) >= floor_target)

    # 6. Objective Function: Minimize Deprivation and Routing Penalties
    objective_terms: list[Any] = []

    # Unmet demand deprivation penalty
    for (n_id, c_id), u_var in u_vars.items():
        node = next(n for n in demand_nodes if n.id == n_id)
        vuln_w = get_vulnerability_weight(node.vulnerable_group)
        prio = commodity_priorities.get(c_id, 1.0)
        # Scaled integer coefficient
        cost_coeff = int(round(100.0 * vuln_w * prio))
        objective_terms.append(cost_coeff * u_var)

    # Routing impedance penalty
    for (d_id, n_id, _v_id), y_var in y_vars.items():
        _, travel_min, p_surv = pair_paths[(d_id, n_id)]
        route_impedance = int(round(10.0 * travel_min + 50.0 * (1.0 - p_surv)))
        objective_terms.append(route_impedance * y_var)

    model.minimize(sum(objective_terms))

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit_sec
    solver.parameters.random_seed = scenario.solver_parameters.random_seed

    status = solver.solve(model)
    solve_duration = round(time.perf_counter() - start_time, 2)

    if status in (cp_model.INFEASIBLE, cp_model.MODEL_INVALID):
        diag = diagnose_scenario_feasibility(scenario, g)
        return None, format_infeasibility_message(diag)

    # Status handling
    solver_status = SolverStatus.OPTIMAL
    if status == cp_model.FEASIBLE:
        # Feasible incumbent found within timeout
        solver_status = SolverStatus.NON_OPTIMAL_INCUMBENT

    # Reconstruct allocations and routes
    allocations: list[AllocationItem] = []
    deliveries_by_node: dict[str, dict[str, int]] = {n.id: {} for n in demand_nodes}
    active_routes: dict[str, tuple[str, str]] = {}

    for (d_id, n_id, c_id, v_id), x_var in x_vars.items():
        val = solver.value(x_var)
        if val > 0:
            allocations.append(
                AllocationItem(
                    demand_node_id=n_id,
                    commodity_id=c_id,
                    vehicle_id=v_id,
                    quantity_delivered=val,
                )
            )
            deliveries_by_node[n_id][c_id] = deliveries_by_node[n_id].get(c_id, 0) + val
            active_routes[v_id] = (d_id, n_id)

    vehicle_routes: list[VehicleRoutePlan] = []
    for v_id, (d_id, n_id) in active_routes.items():
        edge_path, travel_min, p_surv = pair_paths[(d_id, n_id)]
        vehicle_routes.append(
            VehicleRoutePlan(
                vehicle_id=v_id,
                chosen_path=edge_path,
                survival_probability=round(p_surv, 4),
                estimated_travel_time_min=round(travel_min, 2),
                alternative_paths=[],
            )
        )

    unmet_demands: list[UnmetDemandItem] = []
    for (n_id, c_id), u_var in u_vars.items():
        val = solver.value(u_var)
        if val > 0:
            node = next(n for n in demand_nodes if n.id == n_id)
            unmet_demands.append(
                UnmetDemandItem(
                    demand_node_id=n_id,
                    commodity_id=c_id,
                    unmet_quantity=val,
                    vulnerable_group=node.vulnerable_group,
                )
            )

    demands_dict = {n.id: dict(n.demand) for n in demand_nodes}
    vulnerable_groups_map = {n.id: n.vulnerable_group for n in demand_nodes}

    equity = evaluate_equity(
        demands=demands_dict,
        deliveries=deliveries_by_node,
        vulnerable_groups=vulnerable_groups_map,
        commodity_priorities=commodity_priorities,
        alpha_floor=alpha_floor,
        beta_tail_risk=scenario.equity_parameters.beta_tail_risk_weight,
    )

    # Critical bottleneck edges for reconnaissance
    recommendations: list[ReconnaissanceRecommendation] = []
    ranked_bottlenecks: list[tuple[str, float]] = []
    for plan in vehicle_routes:
        for eid in plan.chosen_path:
            # find edge data
            for _u, _v, d in g.edges(data=True):
                if str(d.get("edge_id")) == eid:
                    p = float(d.get("passability_prob", 1.0))
                    if p < 0.85:
                        ranked_bottlenecks.append((eid, 1.0 - p))
                    break

    ranked_bottlenecks.sort(key=lambda item: item[1], reverse=True)
    seen_edges: set[str] = set()
    rank = 1
    for eid, uncertainty in ranked_bottlenecks:
        if eid not in seen_edges and rank <= 5:
            seen_edges.add(eid)
            recommendations.append(
                ReconnaissanceRecommendation(
                    edge_id=eid,
                    expected_regret_reduction=round(uncertainty * 15.0, 2),
                    inspection_cost=10.0,
                    voi_score=round(uncertainty * 1.5, 3),
                    priority_rank=rank,
                )
            )
            rank += 1

    plan_response = PlanResponse(
        plan_id=uuid4(),
        scenario_id=scenario.scenario_id,
        snapshot_id=scenario.snapshot_id,
        solver_status=solver_status,
        solve_time_seconds=solve_duration,
        vehicle_routes=vehicle_routes,
        allocations=allocations,
        unmet_demands=unmet_demands,
        equity_evaluation=equity_evaluation_to_dict(equity),
        reconnaissance_recommendations=recommendations,
        approval_state=ApprovalRecord(status=ApprovalStatus.DRAFT),
    )

    return plan_response, None
