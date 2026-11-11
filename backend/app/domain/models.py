"""Domain models and Pydantic validation schemas for CrisisRoute."""

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class UserRole(StrEnum):
    """System authorization roles."""

    ANALYST = "analyst"
    FIELD_ANALYST = "field_analyst"
    APPROVER = "approver"
    ADMIN = "admin"


class ObservationStatus(StrEnum):
    """Road passability observation statuses."""

    PASSABLE = "passable"
    IMPASSABLE = "impassable"
    PARTIALLY_BLOCKED = "partially_blocked"
    DEBRIS_CLEARED = "debris_cleared"


class SourceType(StrEnum):
    """Source type for road observations."""

    FIELD_PATROL = "field_patrol"
    DRONE_RECON = "drone_recon"
    SATELLITE_RADAR = "satellite_radar"
    LOCAL_AUTHORITY = "local_authority"
    CITIZEN_REPORT = "citizen_report"


class SolverStatus(StrEnum):
    """Optimization solver terminal states."""

    OPTIMAL = "OPTIMAL"
    FEASIBLE = "FEASIBLE"
    NON_OPTIMAL_INCUMBENT = "NON_OPTIMAL_INCUMBENT"
    INFEASIBLE = "INFEASIBLE"
    MODEL_INVALID = "MODEL_INVALID"


class ApprovalStatus(StrEnum):
    """Human approval sign-off status."""

    DRAFT = "DRAFT"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


# ----------------------------------------------------------------------
# Scenario Sub-components
# ----------------------------------------------------------------------


class RegionModel(BaseModel):
    """Geographic region bounding box and coordinate reference definition."""

    name: str = Field(..., min_length=2, max_length=100)
    country: str = "India"
    bbox: list[float] = Field(
        ..., min_length=4, max_length=4, description="[min_lon, min_lat, max_lon, max_lat]"
    )
    crs: str = "EPSG:4326"


class CommodityModel(BaseModel):
    """Relief item specification."""

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    unit_weight_kg: float = Field(..., gt=0)
    priority_weight: float = Field(default=1.0, ge=1.0, le=10.0)


class DepotModel(BaseModel):
    """Forward supply warehouse or staging depot."""

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    coordinates: list[float] = Field(..., min_length=2, max_length=2, description="[lon, lat]")
    inventory: dict[str, int] = Field(default_factory=dict)


class VehicleModel(BaseModel):
    """Transport fleet unit assigned to a depot."""

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    depot_id: str = Field(..., min_length=1)
    capacity_kg: float = Field(..., gt=0)
    average_speed_kmh: float = Field(default=30.0, gt=0)


class DemandNodeModel(BaseModel):
    """Cluster of affected population requiring relief goods."""

    id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    vulnerable_group: str = Field(..., min_length=1)
    population: int = Field(default=100, ge=1)
    coordinates: list[float] = Field(..., min_length=2, max_length=2, description="[lon, lat]")
    demand: dict[str, int] = Field(default_factory=dict)


class EquityParametersModel(BaseModel):
    """Fairness and group protection parameters."""

    min_group_service_floor_alpha: float = Field(default=0.30, ge=0.0, le=1.0)
    beta_tail_risk_weight: float = Field(default=0.20, ge=0.0, le=1.0)


class SolverParametersModel(BaseModel):
    """OR-Tools and scenario sampling parameters."""

    time_limit_seconds: int = Field(default=30, ge=5, le=120)
    scenario_samples_s: int = Field(default=50, ge=10, le=200)
    random_seed: int = Field(default=42)


# ----------------------------------------------------------------------
# Scenario Payloads
# ----------------------------------------------------------------------


class ScenarioCreate(BaseModel):
    """Request payload to create a new relief scenario."""

    name: str = Field(..., min_length=3, max_length=100)
    description: str = ""
    region: RegionModel
    time_horizon_hours: float = Field(default=24.0, ge=1.0, le=168.0)
    commodities: list[CommodityModel]
    depots: list[DepotModel]
    vehicles: list[VehicleModel]
    demand_nodes: list[DemandNodeModel]
    equity_parameters: EquityParametersModel = Field(default_factory=EquityParametersModel)
    solver_parameters: SolverParametersModel = Field(default_factory=SolverParametersModel)


class ScenarioDetail(ScenarioCreate):
    """Full scenario response model with generated identifiers and metadata."""

    scenario_id: UUID = Field(default_factory=uuid4)
    snapshot_id: str = Field(..., min_length=64, max_length=64)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    active_plan_id: UUID | None = None


class ScenarioSummary(BaseModel):
    """Condensed scenario model for dashboard listings."""

    scenario_id: UUID
    name: str
    region_name: str
    created_at: datetime
    active_plan_id: UUID | None = None


# ----------------------------------------------------------------------
# Observation Models
# ----------------------------------------------------------------------


class ObservationCreate(BaseModel):
    """Input payload for a field or sensor report on a road link."""

    edge_id: str
    status: ObservationStatus
    source_type: SourceType = SourceType.FIELD_PATROL
    source_credibility: float = Field(default=0.8, ge=0.0, le=1.0)
    confidence_interval: list[float] = Field(default_factory=lambda: [0.1, 0.9])
    water_depth_cm: float = 0.0
    reported_by: str = "field_unit_01"
    notes: str = ""


class ObservationResponse(ObservationCreate):
    """Stored observation with system timestamps and UUID."""

    observation_id: UUID = Field(default_factory=uuid4)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ----------------------------------------------------------------------
# Routing & Optimization Models
# ----------------------------------------------------------------------


class RouteAlternative(BaseModel):
    """A loopless alternative route option generated via Yen's algorithm."""

    path: list[str]
    survival_probability: float = Field(ge=0.0, le=1.0)
    estimated_travel_time_min: float = Field(ge=0.0)
    jaccard_overlap_with_primary: float = Field(default=0.0, ge=0.0, le=1.0)


class VehicleRoutePlan(BaseModel):
    """Routing decision for a single vehicle."""

    vehicle_id: str
    depot_id: str | None = None
    destination_node_id: str | None = None
    payload_kg: float | None = None
    chosen_path: list[str]
    survival_probability: float = Field(ge=0.0, le=1.0)
    estimated_travel_time_min: float = Field(ge=0.0)
    alternative_paths: list[RouteAlternative] = Field(default_factory=list)


class AllocationItem(BaseModel):
    """Commodity allocation delivered to a demand node."""

    demand_node_id: str
    commodity_id: str
    vehicle_id: str
    quantity_delivered: int = Field(ge=0)


class UnmetDemandItem(BaseModel):
    """Recorded unmet demand slack."""

    demand_node_id: str
    commodity_id: str
    unmet_quantity: int = Field(ge=0)
    vulnerable_group: str


class ReconnaissanceRecommendation(BaseModel):
    """Value-of-Information (VOI) candidate for field inspection."""

    edge_id: str
    expected_regret_reduction: float
    inspection_cost: float = Field(gt=0)
    voi_score: float
    priority_rank: int = Field(ge=1)


class ApprovalRecord(BaseModel):
    """Human approver sign-off metadata."""

    status: ApprovalStatus = ApprovalStatus.DRAFT
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None
    rationale: str | None = None


class PlanResponse(BaseModel):
    """Complete decision support relief plan."""

    plan_id: UUID = Field(default_factory=uuid4)
    scenario_id: UUID
    snapshot_id: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    generated_by: str | None = None
    solver_status: SolverStatus = SolverStatus.FEASIBLE
    solve_time_seconds: float = 0.0
    vehicle_routes: list[VehicleRoutePlan] = Field(default_factory=list)
    allocations: list[AllocationItem] = Field(default_factory=list)
    unmet_demands: list[UnmetDemandItem] = Field(default_factory=list)
    equity_evaluation: dict[str, Any] = Field(default_factory=dict)
    reconnaissance_recommendations: list[ReconnaissanceRecommendation] = Field(default_factory=list)
    approval_state: ApprovalRecord = Field(default_factory=ApprovalRecord)
