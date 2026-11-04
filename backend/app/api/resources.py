"""Resource management endpoints for depots, demand clusters, vehicles, and commodities."""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.scenarios import SCENARIO_STORE
from app.domain.models import (
    CommodityModel,
    DemandNodeModel,
    DepotModel,
    UserRole,
    VehicleModel,
)
from app.security.auth import CurrentUser, record_audit_event, require_role

router = APIRouter(prefix="/scenarios/{scenario_id}/resources", tags=["Resources"])


class ScenarioResourcesResponse(BaseModel):
    """Consolidated inventory and resource state for an active scenario."""

    scenario_id: UUID
    depots: list[DepotModel]
    demand_nodes: list[DemandNodeModel]
    vehicles: list[VehicleModel]
    commodities: list[CommodityModel]
    total_demand_by_commodity: dict[str, int]
    total_supply_by_commodity: dict[str, int]
    total_fleet_capacity_kg: float


def _get_scenario_or_404(scenario_id: UUID) -> Any:
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )
    return SCENARIO_STORE[sid]


@router.get("", response_model=ScenarioResourcesResponse)
def get_scenario_resources(scenario_id: UUID) -> ScenarioResourcesResponse:
    """Retrieve full consolidated resource inventory, fleet, and demand for a scenario."""
    scenario = _get_scenario_or_404(scenario_id)

    total_demand: dict[str, int] = {}
    for d in scenario.demand_nodes:
        for cid, qty in d.demand.items():
            total_demand[cid] = total_demand.get(cid, 0) + qty

    total_supply: dict[str, int] = {}
    for dep in scenario.depots:
        for cid, qty in dep.inventory.items():
            total_supply[cid] = total_supply.get(cid, 0) + qty

    total_capacity = sum(v.capacity_kg for v in scenario.vehicles)

    return ScenarioResourcesResponse(
        scenario_id=scenario.scenario_id,
        depots=scenario.depots,
        demand_nodes=scenario.demand_nodes,
        vehicles=scenario.vehicles,
        commodities=scenario.commodities,
        total_demand_by_commodity=total_demand,
        total_supply_by_commodity=total_supply,
        total_fleet_capacity_kg=round(total_capacity, 2),
    )


@router.post("/demand-nodes", response_model=DemandNodeModel, status_code=status.HTTP_201_CREATED)
def add_or_update_demand_node(
    scenario_id: UUID,
    payload: DemandNodeModel,
    current_user: CurrentUser = Depends(require_role([UserRole.ANALYST, UserRole.ADMIN])),
) -> DemandNodeModel:
    """Add or update a relief demand cluster."""
    scenario = _get_scenario_or_404(scenario_id)

    existing_idx = next(
        (i for i, d in enumerate(scenario.demand_nodes) if d.id == payload.id), None
    )
    if existing_idx is not None:
        scenario.demand_nodes[existing_idx] = payload
    else:
        scenario.demand_nodes.append(payload)

    record_audit_event(
        user_id=current_user.user_id,
        action="UPDATE_DEMAND_NODE",
        resource_type="demand_node",
        resource_id=payload.id,
        details={"scenario_id": str(scenario_id), "demand": payload.demand},
    )
    return payload


@router.delete("/demand-nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_demand_node(
    scenario_id: UUID,
    node_id: str,
    current_user: CurrentUser = Depends(require_role([UserRole.ANALYST, UserRole.ADMIN])),
) -> None:
    """Remove a demand node from a scenario."""
    scenario = _get_scenario_or_404(scenario_id)
    scenario.demand_nodes = [d for d in scenario.demand_nodes if d.id != node_id]

    record_audit_event(
        user_id=current_user.user_id,
        action="DELETE_DEMAND_NODE",
        resource_type="demand_node",
        resource_id=node_id,
        details={"scenario_id": str(scenario_id)},
    )


@router.post("/depots", response_model=DepotModel, status_code=status.HTTP_201_CREATED)
def add_or_update_depot(
    scenario_id: UUID,
    payload: DepotModel,
    current_user: CurrentUser = Depends(require_role([UserRole.ANALYST, UserRole.ADMIN])),
) -> DepotModel:
    """Add or update a relief supply depot."""
    scenario = _get_scenario_or_404(scenario_id)

    existing_idx = next((i for i, d in enumerate(scenario.depots) if d.id == payload.id), None)
    if existing_idx is not None:
        scenario.depots[existing_idx] = payload
    else:
        scenario.depots.append(payload)

    record_audit_event(
        user_id=current_user.user_id,
        action="UPDATE_DEPOT",
        resource_type="depot",
        resource_id=payload.id,
        details={"scenario_id": str(scenario_id), "inventory": payload.inventory},
    )
    return payload


@router.post("/vehicles", response_model=VehicleModel, status_code=status.HTTP_201_CREATED)
def add_or_update_vehicle(
    scenario_id: UUID,
    payload: VehicleModel,
    current_user: CurrentUser = Depends(require_role([UserRole.ANALYST, UserRole.ADMIN])),
) -> VehicleModel:
    """Add or update a transport fleet vehicle."""
    scenario = _get_scenario_or_404(scenario_id)

    existing_idx = next((i for i, v in enumerate(scenario.vehicles) if v.id == payload.id), None)
    if existing_idx is not None:
        scenario.vehicles[existing_idx] = payload
    else:
        scenario.vehicles.append(payload)

    record_audit_event(
        user_id=current_user.user_id,
        action="UPDATE_VEHICLE",
        resource_type="vehicle",
        resource_id=payload.id,
        details={"scenario_id": str(scenario_id), "capacity_kg": payload.capacity_kg},
    )
    return payload

