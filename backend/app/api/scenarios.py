"""Scenario, observation, and mock vertical slice endpoints."""

import hashlib
import json
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.domain.models import (
    AllocationItem,
    ApprovalRecord,
    ApprovalStatus,
    ObservationCreate,
    ObservationResponse,
    PlanResponse,
    ReconnaissanceRecommendation,
    RegionModel,
    ScenarioCreate,
    ScenarioDetail,
    ScenarioSummary,
    SolverStatus,
    UnmetDemandItem,
    UserRole,
    VehicleRoutePlan,
)
from app.security.auth import CurrentUser, record_audit_event, require_role

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])

# In-memory storage for active scenarios and observations
SCENARIO_STORE: dict[str, ScenarioDetail] = {}
OBSERVATION_STORE: dict[str, list[ObservationResponse]] = {}
PLAN_STORE: dict[str, PlanResponse] = {}


def _load_canonical_fixture() -> dict[str, Any]:
    """Load canonical scenario fixture from contracts directory."""
    fixture_path = settings.contracts_dir / "fixtures" / "scenario.json"
    if not fixture_path.exists():
        contracts_root = Path(__file__).resolve().parent.parent.parent.parent / "contracts"
        fixture_path = contracts_root / "fixtures" / "scenario.json"

    if fixture_path.exists():
        with open(fixture_path, encoding="utf-8") as f:
            data = json.load(f)
            return dict(data) if isinstance(data, dict) else {}
    return {}


def seed_canonical_scenario() -> ScenarioDetail:
    """Ensure canonical Kerala scenario fixture is pre-seeded in memory."""
    data = _load_canonical_fixture()
    if data:
        scenario = ScenarioDetail(**data)
        SCENARIO_STORE[str(scenario.scenario_id)] = scenario
        return scenario

    scenario = ScenarioDetail(
        scenario_id=UUID("a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"),
        snapshot_id="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        name="Kerala Monsoon 2026 - Wayanad & Periyar Basin Rapid Response",
        description="Seeded benchmark scenario for monsoon flood relief in Kerala",
        region=RegionModel(
            name="Wayanad-Periyar Relief Corridor",
            country="India",
            bbox=[75.9, 11.45, 76.4, 11.95],
            crs="EPSG:4326",
        ),
        time_horizon_hours=24.0,
        commodities=[],
        depots=[],
        vehicles=[],
        demand_nodes=[],
    )
    SCENARIO_STORE[str(scenario.scenario_id)] = scenario
    return scenario


# Initialize on import
seed_canonical_scenario()


@router.get("", response_model=list[ScenarioSummary])
def list_scenarios() -> list[ScenarioSummary]:
    """List all available relief planning scenarios."""
    return [
        ScenarioSummary(
            scenario_id=s.scenario_id,
            name=s.name,
            region_name=s.region.name,
            created_at=s.created_at,
            active_plan_id=s.active_plan_id,
        )
        for s in SCENARIO_STORE.values()
    ]


@router.post("", response_model=ScenarioDetail, status_code=status.HTTP_201_CREATED)
def create_scenario(
    payload: ScenarioCreate,
    current_user: CurrentUser = Depends(require_role([UserRole.ANALYST, UserRole.ADMIN])),
) -> ScenarioDetail:
    """Create a new relief planning scenario sealed with a content snapshot hash."""
    serialized = json.dumps(payload.model_dump(), sort_keys=True)
    snapshot_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    scenario = ScenarioDetail(
        **payload.model_dump(),
        scenario_id=uuid4(),
        snapshot_id=snapshot_hash,
    )
    SCENARIO_STORE[str(scenario.scenario_id)] = scenario

    record_audit_event(
        user_id=current_user.user_id,
        action="CREATE_SCENARIO",
        resource_type="scenario",
        resource_id=str(scenario.scenario_id),
        details={"name": scenario.name, "snapshot_id": snapshot_hash},
    )

    return scenario


@router.get("/{scenario_id}", response_model=ScenarioDetail)
def get_scenario(scenario_id: UUID) -> ScenarioDetail:
    """Retrieve full details of a specific scenario."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )
    return SCENARIO_STORE[sid]


@router.get("/{scenario_id}/observations", response_model=list[ObservationResponse])
def list_observations(scenario_id: UUID) -> list[ObservationResponse]:
    """List all road condition observations associated with a scenario."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )
    return OBSERVATION_STORE.get(sid, [])


@router.post(
    "/{scenario_id}/observations",
    response_model=ObservationResponse,
    status_code=status.HTTP_201_CREATED,
)
def submit_observation(
    scenario_id: UUID,
    payload: ObservationCreate,
    current_user: CurrentUser = Depends(
        require_role([UserRole.FIELD_ANALYST, UserRole.ANALYST, UserRole.ADMIN])
    ),
) -> ObservationResponse:
    """Register a new field or sensor observation on a road edge."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )

    obs = ObservationResponse(**payload.model_dump())
    if sid not in OBSERVATION_STORE:
        OBSERVATION_STORE[sid] = []
    OBSERVATION_STORE[sid].append(obs)

    record_audit_event(
        user_id=current_user.user_id,
        action="SUBMIT_OBSERVATION",
        resource_type="observation",
        resource_id=str(obs.observation_id),
        details={"edge_id": obs.edge_id, "status": obs.status.value, "scenario_id": sid},
    )

    return obs


@router.post("/{scenario_id}/plans", response_model=PlanResponse)
def generate_mock_plan(
    scenario_id: UUID,
    current_user: CurrentUser = Depends(require_role([UserRole.ANALYST, UserRole.ADMIN])),
) -> PlanResponse:
    """Generate a valid decision support plan (mock vertical slice for Phase 1)."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )

    scenario = SCENARIO_STORE[sid]
    plan_id = uuid4()

    mock_routes = [
        VehicleRoutePlan(
            vehicle_id="VEH-KSRTC-4WD-01",
            chosen_path=["EDGE-WAYANAD-NH766-01", "EDGE-WAYANAD-SH54-04", "EDGE-MEPPADI-ACC-01"],
            survival_probability=0.88,
            estimated_travel_time_min=42.5,
            alternative_paths=[],
        ),
        VehicleRoutePlan(
            vehicle_id="VEH-DEF-TRUCK-03",
            chosen_path=["EDGE-MANANTHAVADY-01", "EDGE-PANAMARAM-MAIN-02"],
            survival_probability=0.94,
            estimated_travel_time_min=35.0,
            alternative_paths=[],
        ),
    ]

    plan = PlanResponse(
        plan_id=plan_id,
        scenario_id=scenario.scenario_id,
        snapshot_id=scenario.snapshot_id,
        solver_status=SolverStatus.FEASIBLE,
        solve_time_seconds=1.24,
        vehicle_routes=mock_routes,
        allocations=[
            AllocationItem(
                demand_node_id="NODE-MEPPADI-ISOLATED",
                commodity_id="COM-WATER-10L",
                vehicle_id="VEH-KSRTC-4WD-01",
                quantity_delivered=200,
            ),
            AllocationItem(
                demand_node_id="NODE-PANAMARAM-FLOOD-CAMP",
                commodity_id="COM-WATER-10L",
                vehicle_id="VEH-DEF-TRUCK-03",
                quantity_delivered=350,
            ),
        ],
        unmet_demands=[
            UnmetDemandItem(
                demand_node_id="NODE-MEPPADI-ISOLATED",
                commodity_id="COM-WATER-10L",
                unmet_quantity=50,
                vulnerable_group="tribal_hamlet",
            )
        ],
        equity_evaluation={
            "min_group_served_fraction": 0.80,
            "group_breakdowns": {
                "tribal_hamlet": {
                    "total_demand": 250,
                    "total_delivered": 200,
                    "served_fraction": 0.80,
                },
                "general_evacuees": {
                    "total_demand": 450,
                    "total_delivered": 350,
                    "served_fraction": 0.778,
                },
            },
        },
        reconnaissance_recommendations=[
            ReconnaissanceRecommendation(
                edge_id="EDGE-WAYANAD-SH54-04",
                expected_regret_reduction=142.5,
                inspection_cost=25.0,
                voi_score=5.7,
                priority_rank=1,
            )
        ],
        approval_state=ApprovalRecord(status=ApprovalStatus.PENDING_APPROVAL),
    )

    PLAN_STORE[str(plan_id)] = plan
    scenario.active_plan_id = plan_id

    record_audit_event(
        user_id=current_user.user_id,
        action="GENERATE_PLAN",
        resource_type="plan",
        resource_id=str(plan_id),
        details={"scenario_id": sid, "solver_status": plan.solver_status.value},
    )

    return plan


class ApprovalPayload(BaseModel):
    """Payload for plan approval / rejection."""

    decision: str
    rationale: str


@router.post("/plans/{plan_id}/approval", response_model=PlanResponse)
def approve_or_reject_plan(
    plan_id: UUID,
    payload: ApprovalPayload,
    current_user: CurrentUser = Depends(require_role([UserRole.APPROVER, UserRole.ADMIN])),
) -> PlanResponse:
    """Incident Lead mandatory approval sign-off with operational rationale."""
    pid = str(plan_id)
    if pid not in PLAN_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )

    if not payload.rationale or len(payload.rationale.strip()) < 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A written operational rationale of at least 10 characters is mandatory.",
        )

    decision_norm = payload.decision.upper()
    if decision_norm not in ["APPROVE", "REJECT"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be 'APPROVE' or 'REJECT'",
        )

    plan = PLAN_STORE[pid]
    plan.approval_state.status = (
        ApprovalStatus.APPROVED if decision_norm == "APPROVE" else ApprovalStatus.REJECTED
    )
    plan.approval_state.reviewed_by = current_user.username
    plan.approval_state.rationale = payload.rationale

    record_audit_event(
        user_id=current_user.user_id,
        action=f"PLAN_{decision_norm}",
        resource_type="plan",
        resource_id=pid,
        details={"rationale": payload.rationale, "approver": current_user.username},
    )

    return plan
