"""Scenario, observation, and mock vertical slice endpoints."""

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, StringConstraints, field_validator

from app.core.config import settings
from app.domain.models import (
    ApprovalStatus,
    ObservationCreate,
    ObservationResponse,
    PlanResponse,
    ScenarioCreate,
    ScenarioDetail,
    ScenarioSummary,
    UserRole,
)
from app.persistence.json_store import ListStore, ModelStore
from app.security.auth import CurrentUser, record_audit_event, require_role

router = APIRouter(prefix="/scenarios", tags=["Scenarios"])

_STATE_ROOT = settings.state_dir if settings.persist_state else None


def _state_dir(name: str):
    return None if _STATE_ROOT is None else _STATE_ROOT / name


# Durable storage (JSON files under CRISISROUTE_STATE_DIR) for scenarios, plans and observations
SCENARIO_STORE: ModelStore[ScenarioDetail] = ModelStore(ScenarioDetail, _state_dir("scenarios"))
OBSERVATION_STORE: ListStore[ObservationResponse] = ListStore(
    ObservationResponse, _state_dir("observations")
)
PLAN_STORE: ModelStore[PlanResponse] = ModelStore(PlanResponse, _state_dir("plans"))


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


def _get_benchmark_scenarios_data() -> list[dict[str, Any]]:
    """Return realistic fallback fixtures for primary Indian disaster relief corridors."""
    common_commodities = [
        {
            "id": "COM-WATER-10L",
            "name": "Packaged Potable Water (10L Can)",
            "unit_weight_kg": 10.0,
            "priority_weight": 5.0,
        },
        {
            "id": "COM-MRE-RATIONS",
            "name": "Emergency Dry Food and Nutrition Kit",
            "unit_weight_kg": 2.5,
            "priority_weight": 4.0,
        },
        {
            "id": "COM-MED-TRAUMA",
            "name": "Essential Medical and Waterborne Disease Kit",
            "unit_weight_kg": 5.0,
            "priority_weight": 5.0,
        },
        {
            "id": "COM-SHELTER-TARPS",
            "name": "Reinforced Tarpaulin and Rope Pack",
            "unit_weight_kg": 8.0,
            "priority_weight": 3.0,
        },
    ]

    kerala = {
        "scenario_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
        "snapshot_id": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "name": "Kerala Monsoon 2026 - Wayanad Relief Corridor",
        "description": "Monsoon flood and landslide relief operations in Wayanad, Kerala",
        "region": {
            "name": "Wayanad-Periyar Relief Corridor",
            "country": "India",
            "bbox": [75.9000, 11.4500, 76.4000, 11.9500],
            "crs": "EPSG:4326",
        },
        "time_horizon_hours": 24.0,
        "commodities": common_commodities,
        "depots": [
            {
                "id": "DEPOT-KALPETTA",
                "name": "Kalpetta Civil Station Forward Depot",
                "coordinates": [76.0825, 11.6080],
                "inventory": {
                    "COM-WATER-10L": 1200,
                    "COM-MRE-RATIONS": 2500,
                    "COM-MED-TRAUMA": 400,
                    "COM-SHELTER-TARPS": 600,
                },
            },
            {
                "id": "DEPOT-MANANTHAVADY",
                "name": "Mananthavady North Staging Warehouse",
                "coordinates": [76.0035, 11.8030],
                "inventory": {
                    "COM-WATER-10L": 800,
                    "COM-MRE-RATIONS": 1800,
                    "COM-MED-TRAUMA": 300,
                    "COM-SHELTER-TARPS": 450,
                },
            },
        ],
        "vehicles": [
            {
                "id": "VEH-KSRTC-4WD-01",
                "name": "Heavy 4WD Relief Truck 01",
                "depot_id": "DEPOT-KALPETTA",
                "capacity_kg": 3500.0,
                "average_speed_kmh": 32.0,
            },
            {
                "id": "VEH-KSRTC-4WD-02",
                "name": "Heavy 4WD Relief Truck 02",
                "depot_id": "DEPOT-KALPETTA",
                "capacity_kg": 3500.0,
                "average_speed_kmh": 32.0,
            },
            {
                "id": "VEH-MED-VAN-01",
                "name": "All-Terrain Medical Ambulance Van",
                "depot_id": "DEPOT-KALPETTA",
                "capacity_kg": 1200.0,
                "average_speed_kmh": 40.0,
            },
            {
                "id": "VEH-DEF-TRUCK-03",
                "name": "Defence Heavy Logistic Carrier",
                "depot_id": "DEPOT-MANANTHAVADY",
                "capacity_kg": 4000.0,
                "average_speed_kmh": 30.0,
            },
        ],
        "demand_nodes": [
            {
                "id": "NODE-MEPPADI-ISOLATED",
                "name": "Meppadi Landslide Cutoff Camp",
                "vulnerable_group": "tribal_hamlet",
                "population": 650,
                "coordinates": [76.1280, 11.5510],
                "demand": {
                    "COM-WATER-10L": 250,
                    "COM-MRE-RATIONS": 500,
                    "COM-MED-TRAUMA": 80,
                    "COM-SHELTER-TARPS": 120,
                },
            },
            {
                "id": "NODE-CHOORALMALA-SHELTER",
                "name": "Chooralmala Valley Community Centre",
                "vulnerable_group": "tea_plantation_workers",
                "population": 820,
                "coordinates": [76.1700, 11.5350],
                "demand": {
                    "COM-WATER-10L": 350,
                    "COM-MRE-RATIONS": 700,
                    "COM-MED-TRAUMA": 100,
                    "COM-SHELTER-TARPS": 160,
                },
            },
            {
                "id": "NODE-VYTHIRI-HEALTH-POST",
                "name": "Vythiri High Inundation Health Sub-Center",
                "vulnerable_group": "elderly_cluster",
                "population": 410,
                "coordinates": [76.0410, 11.5520],
                "demand": {
                    "COM-WATER-10L": 180,
                    "COM-MRE-RATIONS": 320,
                    "COM-MED-TRAUMA": 90,
                    "COM-SHELTER-TARPS": 70,
                },
            },
            {
                "id": "NODE-PANAMARAM-FLOOD-CAMP",
                "name": "Panamaram River Overflow Shelter",
                "vulnerable_group": "general_evacuees",
                "population": 1100,
                "coordinates": [76.0710, 11.7240],
                "demand": {
                    "COM-WATER-10L": 450,
                    "COM-MRE-RATIONS": 900,
                    "COM-MED-TRAUMA": 110,
                    "COM-SHELTER-TARPS": 200,
                },
            },
        ],
        "equity_parameters": {"min_group_service_floor_alpha": 0.40, "beta_tail_risk_weight": 0.30},
        "solver_parameters": {
            "time_limit_seconds": 30,
            "scenario_samples_s": 50,
            "random_seed": 42,
        },
    }

    chamoli = {
        "scenario_id": "b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e",
        "snapshot_id": "f4c1d55309fc2d250bfcf5d9007fc03538bf52f5750c045db060002c8963c966",
        "name": "Uttarakhand Himalayan Subsidence 2026 - Joshimath Corridor",
        "description": "Land subsidence and slope destabilization along Alaknanda Gorge",
        "region": {
            "name": "Chamoli-Alaknanda Disaster Corridor",
            "country": "India",
            "bbox": [79.4500, 30.4000, 79.7500, 30.6500],
            "crs": "EPSG:4326",
        },
        "time_horizon_hours": 36.0,
        "commodities": common_commodities,
        "depots": [
            {
                "id": "DEPOT-CHAMOLI-BASE",
                "name": "Chamoli District Administrative Base",
                "coordinates": [79.5200, 30.4200],
                "inventory": {
                    "COM-WATER-10L": 1000,
                    "COM-MRE-RATIONS": 2000,
                    "COM-MED-TRAUMA": 350,
                    "COM-SHELTER-TARPS": 500,
                },
            },
            {
                "id": "DEPOT-PIPALKOTI",
                "name": "Pipalkoti High Altitude Transit Depot",
                "coordinates": [79.5400, 30.4800],
                "inventory": {
                    "COM-WATER-10L": 700,
                    "COM-MRE-RATIONS": 1500,
                    "COM-MED-TRAUMA": 250,
                    "COM-SHELTER-TARPS": 400,
                },
            },
        ],
        "vehicles": [
            {
                "id": "VEH-ITBP-4WD-01",
                "name": "ITBP Mountain Logistics Carrier 01",
                "depot_id": "DEPOT-CHAMOLI-BASE",
                "capacity_kg": 3000.0,
                "average_speed_kmh": 25.0,
            },
            {
                "id": "VEH-ITBP-4WD-02",
                "name": "ITBP Mountain Logistics Carrier 02",
                "depot_id": "DEPOT-CHAMOLI-BASE",
                "capacity_kg": 3000.0,
                "average_speed_kmh": 25.0,
            },
            {
                "id": "VEH-HILL-AMBULANCE",
                "name": "Mountain Emergency Rescue Van",
                "depot_id": "DEPOT-PIPALKOTI",
                "capacity_kg": 1000.0,
                "average_speed_kmh": 30.0,
            },
        ],
        "demand_nodes": [
            {
                "id": "NODE-JOSHIMATH-UPPER",
                "name": "Upper Joshimath Sinking Sector",
                "vulnerable_group": "hill_pilgrims_and_locals",
                "population": 740,
                "coordinates": [79.5650, 30.5560],
                "demand": {
                    "COM-WATER-10L": 280,
                    "COM-MRE-RATIONS": 550,
                    "COM-MED-TRAUMA": 95,
                    "COM-SHELTER-TARPS": 140,
                },
            },
            {
                "id": "NODE-TAPOVAN-TUNNEL-CAMP",
                "name": "Tapovan Valley Evacuation Shelter",
                "vulnerable_group": "hydro_project_workers",
                "population": 520,
                "coordinates": [79.6200, 30.4900],
                "demand": {
                    "COM-WATER-10L": 220,
                    "COM-MRE-RATIONS": 420,
                    "COM-MED-TRAUMA": 70,
                    "COM-SHELTER-TARPS": 100,
                },
            },
            {
                "id": "NODE-HEMKUND-ISOLATED",
                "name": "Govindghat Isolated Relief Point",
                "vulnerable_group": "high_altitude_remote",
                "population": 380,
                "coordinates": [79.6100, 30.6200],
                "demand": {
                    "COM-WATER-10L": 160,
                    "COM-MRE-RATIONS": 310,
                    "COM-MED-TRAUMA": 60,
                    "COM-SHELTER-TARPS": 80,
                },
            },
        ],
        "equity_parameters": {"min_group_service_floor_alpha": 0.40, "beta_tail_risk_weight": 0.35},
        "solver_parameters": {
            "time_limit_seconds": 30,
            "scenario_samples_s": 50,
            "random_seed": 42,
        },
    }

    majuli = {
        "scenario_id": "c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f",
        "snapshot_id": "a5d2e66418ad3e361cfdf6e0118ad14649cf63a6861d156ec171113d9074da77",
        "name": "Assam Brahmaputra Inundation 2026 - Majuli Island Evacuation",
        "description": "Seasonal riverine flooding and embankment breach relief in Majuli",
        "region": {
            "name": "Majuli Riverine Island Corridor",
            "country": "India",
            "bbox": [94.0000, 26.8500, 94.4500, 27.1500],
            "crs": "EPSG:4326",
        },
        "time_horizon_hours": 24.0,
        "commodities": common_commodities,
        "depots": [
            {
                "id": "DEPOT-JORHAT-GHAT",
                "name": "Nimati Ghat Staging Warehouse",
                "coordinates": [94.2500, 26.8600],
                "inventory": {
                    "COM-WATER-10L": 1400,
                    "COM-MRE-RATIONS": 3000,
                    "COM-MED-TRAUMA": 500,
                    "COM-SHELTER-TARPS": 750,
                },
            },
            {
                "id": "DEPOT-GARAMUR",
                "name": "Garamur Central Relief Depot",
                "coordinates": [94.2200, 26.9600],
                "inventory": {
                    "COM-WATER-10L": 900,
                    "COM-MRE-RATIONS": 2100,
                    "COM-MED-TRAUMA": 320,
                    "COM-SHELTER-TARPS": 500,
                },
            },
        ],
        "vehicles": [
            {
                "id": "VEH-AMPHIB-01",
                "name": "All-Terrain Amphibious Logistics Truck 01",
                "depot_id": "DEPOT-JORHAT-GHAT",
                "capacity_kg": 3200.0,
                "average_speed_kmh": 28.0,
            },
            {
                "id": "VEH-RIVER-CARRIER-02",
                "name": "Heavy High-Clearance Rescue Carrier",
                "depot_id": "DEPOT-GARAMUR",
                "capacity_kg": 3800.0,
                "average_speed_kmh": 26.0,
            },
            {
                "id": "VEH-NDRF-MED",
                "name": "NDRF Riverine Mobile Medical Unit",
                "depot_id": "DEPOT-JORHAT-GHAT",
                "capacity_kg": 1500.0,
                "average_speed_kmh": 35.0,
            },
        ],
        "demand_nodes": [
            {
                "id": "NODE-KAMALABARI-CAMP",
                "name": "Kamalabari Primary Inundation Camp",
                "vulnerable_group": "riverine_tribal_villagers",
                "population": 890,
                "coordinates": [94.1600, 26.9500],
                "demand": {
                    "COM-WATER-10L": 380,
                    "COM-MRE-RATIONS": 760,
                    "COM-MED-TRAUMA": 115,
                    "COM-SHELTER-TARPS": 180,
                },
            },
            {
                "id": "NODE-AUNIATI-SHELTER",
                "name": "Auniati Satra Flood Shelter",
                "vulnerable_group": "monastery_residents_elders",
                "population": 620,
                "coordinates": [94.1000, 26.9200],
                "demand": {
                    "COM-WATER-10L": 260,
                    "COM-MRE-RATIONS": 520,
                    "COM-MED-TRAUMA": 85,
                    "COM-SHELTER-TARPS": 130,
                },
            },
            {
                "id": "NODE-JENGRAIMUKH-NORTH",
                "name": "North Jengraimukh Cutoff Settlement",
                "vulnerable_group": "displaced_farmers",
                "population": 950,
                "coordinates": [94.3400, 27.0800],
                "demand": {
                    "COM-WATER-10L": 420,
                    "COM-MRE-RATIONS": 840,
                    "COM-MED-TRAUMA": 130,
                    "COM-SHELTER-TARPS": 210,
                },
            },
        ],
        "equity_parameters": {"min_group_service_floor_alpha": 0.40, "beta_tail_risk_weight": 0.30},
        "solver_parameters": {
            "time_limit_seconds": 30,
            "scenario_samples_s": 50,
            "random_seed": 42,
        },
    }

    return [kerala, chamoli, majuli]


def build_benchmark_scenarios() -> list[ScenarioDetail]:
    """Fresh copies of the three seeded Indian corridor scenarios (never the stored objects)."""
    return [ScenarioDetail(**data) for data in _get_benchmark_scenarios_data()]


def seed_canonical_scenario() -> ScenarioDetail:
    """Ensure all authentic Indian benchmark scenarios are pre-seeded in memory."""
    data = _load_canonical_fixture()
    benchmarks = _get_benchmark_scenarios_data()

    canonical_scen = ScenarioDetail(**(data or benchmarks[0]))
    # Seed only what is missing so restarts keep active plans and edits. The returned object is
    # always a pristine copy, so experiments never inherit state mutated through the API.
    if str(canonical_scen.scenario_id) not in SCENARIO_STORE:
        SCENARIO_STORE[str(canonical_scen.scenario_id)] = canonical_scen.model_copy(deep=True)

    for b_data in benchmarks[1:]:
        scen = ScenarioDetail(**b_data)
        if str(scen.scenario_id) not in SCENARIO_STORE:
            SCENARIO_STORE[str(scen.scenario_id)] = scen

    return canonical_scen


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
def list_observations(
    scenario_id: UUID,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[ObservationResponse]:
    """List all road condition observations associated with a scenario."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )
    newest_first = list(reversed(OBSERVATION_STORE.get(sid)))
    return newest_first[offset : offset + limit]


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
    OBSERVATION_STORE.append(sid, obs)

    record_audit_event(
        user_id=current_user.user_id,
        action="SUBMIT_OBSERVATION",
        resource_type="observation",
        resource_id=str(obs.observation_id),
        details={"edge_id": obs.edge_id, "status": obs.status.value, "scenario_id": sid},
    )

    return obs


def reseal_scenario(scenario: ScenarioDetail) -> None:
    """Recompute the content hash after an edit so plans and caches tied to the old data lapse."""
    content = scenario.model_dump(
        mode="json", exclude={"scenario_id", "snapshot_id", "created_at", "active_plan_id"}
    )
    scenario.snapshot_id = hashlib.sha256(
        json.dumps(content, sort_keys=True).encode("utf-8")
    ).hexdigest()
    SCENARIO_STORE.save(str(scenario.scenario_id))


def _get_plan_or_404(plan_id: str) -> PlanResponse:
    plan = PLAN_STORE.get(plan_id)
    if plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Plan {plan_id} not found"
        )
    return plan


def _plan_is_stale(plan: PlanResponse) -> bool:
    """Stale when a field report arrived after it, or the scenario data was edited."""
    scenario = SCENARIO_STORE.get(str(plan.scenario_id))
    if scenario is not None and scenario.snapshot_id != plan.snapshot_id:
        return True
    latest = max((o.timestamp for o in OBSERVATION_STORE.get(str(plan.scenario_id))), default=None)
    return latest is not None and latest > plan.generated_at


class ApprovalPayload(BaseModel):
    """Payload for plan approval / rejection."""

    decision: Literal["APPROVE", "REJECT"]
    rationale: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=10, max_length=2000)
    ]

    @field_validator("decision", mode="before")
    @classmethod
    def _normalise_decision(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value


def _decide_plan(
    plan: PlanResponse,
    decision: str,
    rationale: str,
    user: CurrentUser,
    audit_resource: tuple[str, str] | None = None,
) -> PlanResponse:
    """Apply a human sign-off decision, enforcing the approval gate rules."""
    pid = str(plan.plan_id)
    current = plan.approval_state.status
    if current in (ApprovalStatus.APPROVED, ApprovalStatus.REJECTED):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Plan was already {current.value.lower()}; generate a new plan to change it.",
        )
    if current != ApprovalStatus.PENDING_APPROVAL:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Plan must be submitted for approval before it can be signed off.",
        )
    if plan.generated_by and plan.generated_by == user.user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The person who generated a plan cannot approve or reject it (four-eyes rule).",
        )
    if decision == "APPROVE" and _plan_is_stale(plan):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Field data or scenario inputs changed since this plan. Re-optimize first.",
        )

    plan.approval_state.status = (
        ApprovalStatus.APPROVED if decision == "APPROVE" else ApprovalStatus.REJECTED
    )
    plan.approval_state.reviewed_by = user.username
    plan.approval_state.reviewed_at = datetime.now(UTC)
    plan.approval_state.rationale = rationale
    PLAN_STORE.save(pid)

    resource_type, resource_id = audit_resource or ("plan", pid)
    record_audit_event(
        user_id=user.user_id,
        action=f"PLAN_{decision}" if resource_type == "plan" else "PLAN_APPROVAL",
        resource_type=resource_type,
        resource_id=resource_id,
        details={
            "decision": decision,
            "rationale": rationale,
            "approver": user.username,
            "plan_id": pid,
            "snapshot_id": plan.snapshot_id,
        },
    )
    return plan


@router.post("/plans/{plan_id}/submit", response_model=PlanResponse)
def submit_plan_for_approval(
    plan_id: UUID,
    current_user: CurrentUser = Depends(require_role([UserRole.ANALYST, UserRole.ADMIN])),
) -> PlanResponse:
    """Hand a draft plan to the Incident Lead for sign-off."""
    plan = _get_plan_or_404(str(plan_id))
    if plan.approval_state.status != ApprovalStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only draft plans can be submitted "
                f"(current status: {plan.approval_state.status.value})."
            ),
        )
    plan.approval_state.status = ApprovalStatus.PENDING_APPROVAL
    PLAN_STORE.save(str(plan_id))
    record_audit_event(
        user_id=current_user.user_id,
        action="PLAN_SUBMITTED",
        resource_type="plan",
        resource_id=str(plan_id),
        details={"scenario_id": str(plan.scenario_id)},
    )
    return plan


@router.post("/plans/{plan_id}/approval", response_model=PlanResponse)
def approve_or_reject_plan(
    plan_id: UUID,
    payload: ApprovalPayload,
    current_user: CurrentUser = Depends(require_role([UserRole.APPROVER, UserRole.ADMIN])),
) -> PlanResponse:
    """Incident Lead mandatory approval sign-off with operational rationale."""
    plan = _get_plan_or_404(str(plan_id))
    return _decide_plan(plan, payload.decision, payload.rationale, current_user)


class ScenarioApprovalResponse(BaseModel):
    """Response model for scenario approval sign-off."""

    status: str
    approver_id: str
    rationale: str
    scenario_id: str
    plan_id: str


@router.post("/{scenario_id}/approve", response_model=ScenarioApprovalResponse)
def approve_scenario(
    scenario_id: UUID,
    payload: ApprovalPayload,
    current_user: CurrentUser = Depends(require_role([UserRole.APPROVER, UserRole.ADMIN])),
) -> ScenarioApprovalResponse:
    """Sign off the scenario's active plan (same rules as the per-plan endpoint)."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )
    scenario = SCENARIO_STORE[sid]
    if not scenario.active_plan_id or str(scenario.active_plan_id) not in PLAN_STORE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This scenario has no active plan to approve. Generate and submit one first.",
        )
    plan = _decide_plan(
        PLAN_STORE[str(scenario.active_plan_id)],
        payload.decision,
        payload.rationale,
        current_user,
        audit_resource=("scenario", sid),
    )
    return ScenarioApprovalResponse(
        status=plan.approval_state.status.value,
        approver_id=current_user.user_id,
        rationale=payload.rationale,
        scenario_id=sid,
        plan_id=str(plan.plan_id),
    )
