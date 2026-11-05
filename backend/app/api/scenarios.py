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


def seed_canonical_scenario() -> ScenarioDetail:
    """Ensure all authentic Indian benchmark scenarios are pre-seeded in memory."""
    data = _load_canonical_fixture()
    benchmarks = _get_benchmark_scenarios_data()

    if data:
        canonical_scen = ScenarioDetail(**data)
        SCENARIO_STORE[str(canonical_scen.scenario_id)] = canonical_scen
    else:
        canonical_scen = ScenarioDetail(**benchmarks[0])
        SCENARIO_STORE[str(canonical_scen.scenario_id)] = canonical_scen

    for b_data in benchmarks[1:]:
        scen = ScenarioDetail(**b_data)
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


class ScenarioApprovalPayload(BaseModel):
    """Payload for direct scenario approval."""

    decision: str = "APPROVE"
    rationale: str


class ScenarioApprovalResponse(BaseModel):
    """Response model for scenario approval sign-off."""

    status: str
    approver_id: str
    rationale: str
    scenario_id: str
    plan_id: str | None = None


@router.post("/{scenario_id}/approve", response_model=ScenarioApprovalResponse)
def approve_scenario(
    scenario_id: UUID,
    payload: ScenarioApprovalPayload,
    current_user: CurrentUser = Depends(require_role([UserRole.APPROVER, UserRole.ADMIN])),
) -> ScenarioApprovalResponse:
    """Incident Lead direct scenario approval sign-off with audit trail."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )

    if not payload.rationale or len(payload.rationale.strip()) < 10:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A written operational rationale of at least 10 characters is mandatory.",
        )

    decision = payload.decision.upper()
    scenario = SCENARIO_STORE[sid]
    if scenario.active_plan_id and str(scenario.active_plan_id) in PLAN_STORE:
        plan = PLAN_STORE[str(scenario.active_plan_id)]
        plan.approval_state.status = (
            ApprovalStatus.APPROVED if decision == "APPROVE" else ApprovalStatus.REJECTED
        )
        plan.approval_state.reviewed_by = current_user.username
        plan.approval_state.rationale = payload.rationale

    record_audit_event(
        user_id=current_user.user_id,
        action="PLAN_APPROVAL",
        resource_type="scenario",
        resource_id=sid,
        details={
            "decision": decision,
            "rationale": payload.rationale,
            "approver": current_user.username,
            "active_plan_id": str(scenario.active_plan_id) if scenario.active_plan_id else None,
        },
    )

    return ScenarioApprovalResponse(
        status="APPROVED" if decision == "APPROVE" else "REJECTED",
        approver_id=current_user.user_id,
        rationale=payload.rationale,
        scenario_id=sid,
        plan_id=str(scenario.active_plan_id) if scenario.active_plan_id else None,
    )
