"""Road network passability, dynamic observation propagation, and model calibration metrics."""

import json
from functools import lru_cache
from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.scenarios import OBSERVATION_STORE, SCENARIO_STORE
from app.core.cache import ResponseCache
from app.core.config import settings
from app.domain.models import ScenarioDetail
from app.graph.live import build_live_graph

router = APIRouter(prefix="/scenarios/{scenario_id}/passability", tags=["Passability"])


class PassabilityEdgeItem(BaseModel):
    """Calibrated passability evaluation for a specific directed road edge."""

    edge_id: str
    u_node: str
    v_node: str
    u_coord: list[float] = Field(..., description="[lon, lat]")
    v_coord: list[float] = Field(..., description="[lon, lat]")
    road_class: str
    bridge: bool
    length_m: float
    free_flow_sec: float
    passability_prob: float
    credible_interval: list[float] = Field(..., description="[lower_95, upper_95]")
    stale_age_hours: float
    risk_class: str = Field(..., description="PASSABLE, MODERATE, or CRITICAL")


class PassabilityNodeItem(BaseModel):
    """Geographic network node in the disaster corridor."""

    node_id: str
    name: str
    node_type: str = Field(..., description="depot, demand, or junction")
    coordinates: list[float] = Field(..., description="[lon, lat]")
    vulnerable_group: str | None = None
    population: int | None = None


class CalibrationBin(BaseModel):
    """Reliability diagram evaluation bin."""

    bin_index: int
    bin_range: list[float]
    confidence: float
    accuracy: float
    count: int
    calibration_gap: float


class ModelMetricsSummary(BaseModel):
    """Scientific calibration assessment and distribution shift metrics."""

    model_version: str
    model_type: str
    evaluation: str = ""
    brier_score: float
    expected_calibration_error: float
    roc_auc: float
    total_samples: int
    reliability_diagram: list[CalibrationBin]


class PassabilitySummary(BaseModel):
    """Network-wide passability breakdown."""

    total_edges: int
    passable_count: int
    moderate_count: int
    critical_count: int
    bridges_count: int
    average_passability: float


class PassabilityResponse(BaseModel):
    """Consolidated passability, network topology, and ML calibration state."""

    scenario_id: UUID
    region_name: str
    edges: list[PassabilityEdgeItem]
    nodes: list[PassabilityNodeItem]
    calibration_metrics: ModelMetricsSummary | None = Field(
        default=None, description="Null until the experiments pipeline has produced a report"
    )
    graph_source: str = Field(default="synthetic_corridor")
    summary: PassabilitySummary


def _get_credible_interval(prob: float) -> list[float]:
    """Compute approximate 95% Wilson-score credible interval around passability probability."""
    # Standard binomial uncertainty scaled with sample size n=30
    margin = 1.96 * ((prob * (1.0 - prob) + 1e-4) / 30.0) ** 0.5
    low = max(0.01, round(prob - margin, 3))
    high = min(0.99, round(prob + margin, 3))
    return [low, high]


def _get_risk_class(prob: float) -> str:
    """Classify risk level based on operational hazard thresholds."""
    if prob >= 0.80:
        return "PASSABLE"
    if prob >= 0.50:
        return "MODERATE"
    return "CRITICAL"


_PASSABILITY_CACHE: ResponseCache[PassabilityResponse] = ResponseCache(32)


@lru_cache(maxsize=1)
def _load_calibration_metrics() -> ModelMetricsSummary | None:
    """Held-out calibration metrics written by the experiments pipeline, if available."""
    path = settings.reports_dir / "model_calibration.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return ModelMetricsSummary(
            model_version=data["model_version"],
            model_type=data["model_type"],
            evaluation=data.get("evaluation", ""),
            brier_score=data["brier_score"],
            expected_calibration_error=data["expected_calibration_error"],
            roc_auc=data["roc_auc"],
            total_samples=data["total_samples"],
            reliability_diagram=[CalibrationBin(**b) for b in data["reliability_diagram"]],
        )
    except (KeyError, ValueError, OSError):
        return None


@router.get("", response_model=PassabilityResponse)
def get_scenario_passability(scenario_id: UUID) -> PassabilityResponse:
    """Retrieve full road network passability, active observations, and ML calibration state."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )

    scenario = SCENARIO_STORE[sid]
    key = (sid, scenario.snapshot_id, OBSERVATION_STORE.version(sid))
    return _PASSABILITY_CACHE.get_or_compute(key, lambda: _compute_passability(scenario))


def _compute_passability(scenario: ScenarioDetail) -> PassabilityResponse:
    sid = str(scenario.scenario_id)
    g = build_live_graph(scenario, OBSERVATION_STORE.get(sid))

    # Build node list
    nodes: list[PassabilityNodeItem] = []
    for node_id, data in g.nodes(data=True):
        lon = float(data.get("lon", 0.0))
        lat = float(data.get("lat", 0.0))
        node_type = str(data.get("node_type", "junction"))
        name = str(data.get("name", node_id))

        vuln = None
        pop = None
        if node_type == "demand":
            for dn in scenario.demand_nodes:
                if dn.id == node_id:
                    vuln = dn.vulnerable_group
                    pop = dn.population
                    break

        nodes.append(
            PassabilityNodeItem(
                node_id=node_id,
                name=name,
                node_type=node_type,
                coordinates=[lon, lat],
                vulnerable_group=vuln,
                population=pop,
            )
        )

    # Build edge list
    edges: list[PassabilityEdgeItem] = []
    passable_c = 0
    moderate_c = 0
    critical_c = 0
    bridge_c = 0
    total_prob = 0.0

    for u, v, d in g.edges(data=True):
        u_data = g.nodes[u]
        v_data = g.nodes[v]
        u_coord = [float(u_data.get("lon", 0.0)), float(u_data.get("lat", 0.0))]
        v_coord = [float(v_data.get("lon", 0.0)), float(v_data.get("lat", 0.0))]

        p = round(float(d.get("passability_prob", 0.90)), 3)
        bridge = bool(d.get("bridge", False))
        if bridge:
            bridge_c += 1

        risk = _get_risk_class(p)
        if risk == "PASSABLE":
            passable_c += 1
        elif risk == "MODERATE":
            moderate_c += 1
        else:
            critical_c += 1

        total_prob += p

        edges.append(
            PassabilityEdgeItem(
                edge_id=str(d.get("edge_id")),
                u_node=str(u),
                v_node=str(v),
                u_coord=u_coord,
                v_coord=v_coord,
                road_class=str(d.get("road_class", "primary")),
                bridge=bridge,
                length_m=float(d.get("length_m", 1000.0)),
                free_flow_sec=float(d.get("free_flow_sec", 100.0)),
                passability_prob=p,
                credible_interval=_get_credible_interval(p),
                stale_age_hours=float(d.get("stale_age_hours", 0.5)),
                risk_class=risk,
            )
        )

    num_edges = max(1, len(edges))
    summary = PassabilitySummary(
        total_edges=len(edges),
        passable_count=passable_c,
        moderate_count=moderate_c,
        critical_count=critical_c,
        bridges_count=bridge_c,
        average_passability=round(total_prob / num_edges, 3),
    )

    return PassabilityResponse(
        scenario_id=scenario.scenario_id,
        region_name=scenario.region.name,
        edges=edges,
        nodes=nodes,
        calibration_metrics=_load_calibration_metrics(),
        summary=summary,
    )
