"""Allocation optimization and plan management endpoints."""

from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.scenarios import OBSERVATION_STORE, PLAN_STORE, SCENARIO_STORE
from app.domain.models import (
    ApprovalRecord,
    ApprovalStatus,
    PlanResponse,
    SolverStatus,
    UserRole,
)
from app.domain.observations import ObservationGraphManager
from app.graph.build import build_scenario_corridor_graph
from app.optimization.baseline import solve_proportional_baseline
from app.optimization.model import solve_equitable_allocation
from app.optimization.objective import equity_evaluation_to_dict
from app.security.auth import CurrentUser, record_audit_event, require_role

router = APIRouter(prefix="/scenarios/{scenario_id}/plans", tags=["Allocation & Plans"])


def _get_scenario_or_404(scenario_id: UUID) -> Any:
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )
    return SCENARIO_STORE[sid]


@router.post("/optimize", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
def optimize_allocation_plan(
    scenario_id: UUID,
    mode: str = Query(default="robust", pattern="^(robust|baseline)$"),
    current_user: CurrentUser = Depends(require_role([UserRole.ANALYST, UserRole.ADMIN])),
) -> PlanResponse:
    """Generate an equitable humanitarian relief allocation plan using CP-SAT or baseline."""
    scenario = _get_scenario_or_404(scenario_id)
    sid = str(scenario_id)

    # 1. Build base corridor graph for the scenario
    g = build_scenario_corridor_graph(scenario)

    # 2. Replay active scenario observations onto the graph
    obs_list = OBSERVATION_STORE.get(sid)
    for obs in obs_list:
        g, _, _ = ObservationGraphManager.apply_observation_to_graph(g, obs)

    # 3. Solve based on requested mode
    if mode == "baseline":
        res = solve_proportional_baseline(scenario, g)
        plan = PlanResponse(
            plan_id=uuid4(),
            scenario_id=scenario.scenario_id,
            snapshot_id=scenario.snapshot_id,
            solver_status=SolverStatus.FEASIBLE,
            solve_time_seconds=0.05,
            vehicle_routes=res["vehicle_routes"],
            allocations=res["allocations"],
            unmet_demands=res["unmet_demands"],
            equity_evaluation=equity_evaluation_to_dict(res["equity"]),
            reconnaissance_recommendations=[],
            approval_state=ApprovalRecord(status=ApprovalStatus.DRAFT),
        )
    else:
        plan_opt, diag = solve_equitable_allocation(scenario, g)
        if plan_opt is None:
            # Return clear diagnostic message with HTTP 422
            raise HTTPException(
                status_code=422,
                detail=diag,
            )
        plan = plan_opt

    PLAN_STORE[str(plan.plan_id)] = plan
    scenario.active_plan_id = plan.plan_id
    SCENARIO_STORE.save(sid)

    record_audit_event(
        user_id=current_user.user_id,
        action="OPTIMIZE_ALLOCATION_PLAN",
        resource_type="plan",
        resource_id=str(plan.plan_id),
        details={
            "scenario_id": sid,
            "mode": mode,
            "solver_status": plan.solver_status.value,
            "allocated_items": len(plan.allocations),
            "unmet_items": len(plan.unmet_demands),
        },
    )

    return plan


@router.get("/active", response_model=PlanResponse)
def get_active_plan(scenario_id: UUID) -> PlanResponse:
    """Retrieve the currently active plan for a scenario."""
    scenario = _get_scenario_or_404(scenario_id)
    if not scenario.active_plan_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active plan found for scenario {scenario_id}",
        )
    pid = str(scenario.active_plan_id)
    if pid not in PLAN_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active plan {pid} not present in plan repository",
        )
    return PLAN_STORE[pid]


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(scenario_id: UUID, plan_id: UUID) -> PlanResponse:
    """Retrieve a specific decision plan by its unique ID."""
    _get_scenario_or_404(scenario_id)
    pid = str(plan_id)
    if pid not in PLAN_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    return PLAN_STORE[pid]


@router.get("/{plan_id}/export")
def export_plan_manifest(scenario_id: UUID, plan_id: UUID) -> dict[str, Any]:
    """Export plan in standard JSON schema format for field deployment."""
    plan = get_plan(scenario_id, plan_id)
    return {
        "export_format": "CrisisRoute-Plan-v1",
        "plan_id": str(plan.plan_id),
        "scenario_id": str(plan.scenario_id),
        "snapshot_id": plan.snapshot_id,
        "solver_status": plan.solver_status.value,
        "approval_state": plan.approval_state.model_dump(),
        "allocations": [a.model_dump() for a in plan.allocations],
        "vehicle_routes": [r.model_dump() for r in plan.vehicle_routes],
        "equity_evaluation": plan.equity_evaluation,
    }
