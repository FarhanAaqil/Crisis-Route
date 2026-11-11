"""Intelligence, routing alternatives, Monte Carlo scenario fans, and VoI rankings."""

import time
from uuid import UUID

import networkx as nx
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel

from app.api.scenarios import OBSERVATION_STORE, PLAN_STORE, SCENARIO_STORE
from app.domain.models import ReconnaissanceRecommendation, ScenarioDetail
from app.graph.alternatives import find_k_diverse_alternatives
from app.graph.live import build_live_graph
from app.optimization.evaluation import evaluate_plan_under_samples
from app.optimization.model import solve_equitable_allocation
from app.optimization.recourse import solve_two_stage_recourse
from app.optimization.scenarios_sampler import ScenarioSampleBundle, sample_hazard_scenarios
from app.optimization.voi import rank_reconnaissance_corridors

router = APIRouter(prefix="/scenarios/{scenario_id}", tags=["Intelligence"])


class RouteOption(BaseModel):
    """A loopless candidate delivery route generated via Yen's k-shortest algorithm."""

    rank: int
    node_path: list[str]
    edge_path: list[str]
    travel_time_min: float
    survival_prob: float
    jaccard_overlap_with_primary: float
    eta_inflation_pct: float


class RouteAlternativesResponse(BaseModel):
    """Route comparison between primary path and k-1 diverse alternatives."""

    scenario_id: UUID
    origin_id: str
    destination_id: str
    vehicle_id: str | None = None
    destination_name: str | None = None
    routes: list[RouteOption]


class ScenarioFanResponse(BaseModel):
    """Monte Carlo uncertainty fan evaluated across stochastic realizations."""

    scenario_id: UUID
    num_samples: int
    mean_passability: float
    worst_case_p05: float
    best_case_p95: float
    sampling_duration_ms: int
    sample_survival_rates: list[float]
    deterministic_loss: float
    recourse_loss: float
    expected_shortfall_95: float


class VoiRankingsResponse(BaseModel):
    """Ranked high-value reconnaissance corridors for field inspection."""

    scenario_id: UUID
    targets: list[ReconnaissanceRecommendation]
    total_candidates_evaluated: int


@router.get("/voi-rankings", response_model=VoiRankingsResponse)
def get_voi_rankings(
    scenario_id: UUID,
    top_k: int = Query(default=5, ge=1, le=20),
) -> VoiRankingsResponse:
    """Retrieve Value-of-Information prioritized reconnaissance targets for drone/ground patrol."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )

    scenario = SCENARIO_STORE[sid]
    g = build_live_graph(scenario, OBSERVATION_STORE.get(sid))

    # If an active plan exists, gather its traversed edge paths
    active_paths: list[list[str]] = []
    if scenario.active_plan_id and str(scenario.active_plan_id) in PLAN_STORE:
        plan = PLAN_STORE[str(scenario.active_plan_id)]
        for r in plan.vehicle_routes:
            active_paths.append(r.chosen_path)

    # If no active plan yet, populate active_paths with shortest paths
    # from each depot to demand nodes
    if not active_paths:
        for d in scenario.depots:
            for dn in scenario.demand_nodes:
                try:
                    p = nx.shortest_path(g, d.id, dn.id, weight="free_flow_sec")
                    # Convert node path to edge IDs
                    edge_ids = []
                    for i in range(len(p) - 1):
                        data = g.get_edge_data(p[i], p[i + 1])
                        if data and "edge_id" in data:
                            edge_ids.append(str(data["edge_id"]))
                    if edge_ids:
                        active_paths.append(edge_ids)
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    continue

    targets = rank_reconnaissance_corridors(g, active_paths=active_paths, top_k=top_k)

    return VoiRankingsResponse(
        scenario_id=scenario.scenario_id,
        targets=targets,
        total_candidates_evaluated=len(g.edges()),
    )


_RISK_CACHE: dict[tuple[str, str, int, int], tuple[float, float, float]] = {}


def _plan_risk_comparison(
    scenario: ScenarioDetail,
    g: nx.DiGraph,
    bundle: ScenarioSampleBundle,
    sid: str,
) -> tuple[float, float, float]:
    """Expected deprivation of the nominal plan vs the recourse plan, plus the recourse CVaR(95).

    Both plans are scored on the same sampled worlds. Results are cached per scenario version
    and observation count because the two optimizations take a few seconds.
    """
    key = (sid, scenario.snapshot_id, len(OBSERVATION_STORE.get(sid)), bundle.num_samples)
    if key in _RISK_CACHE:
        return _RISK_CACHE[key]

    nominal, _ = solve_equitable_allocation(scenario, g)
    recourse = solve_two_stage_recourse(
        scenario,
        g,
        num_samples=min(20, bundle.num_samples),
        time_limit_sec=10.0,
        random_seed=scenario.solver_parameters.random_seed,
    )
    det_loss = (
        evaluate_plan_under_samples(scenario, nominal, bundle).expected_loss if nominal else 0.0
    )
    rec_profile = evaluate_plan_under_samples(scenario, recourse.plan, bundle)
    result = (
        round(det_loss, 1),
        round(rec_profile.expected_loss, 1),
        round(rec_profile.expected_shortfall(0.05), 1),
    )
    if len(_RISK_CACHE) >= 32:
        _RISK_CACHE.pop(next(iter(_RISK_CACHE)))
    _RISK_CACHE[key] = result
    return result


@router.get("/scenario-fan", response_model=ScenarioFanResponse)
def get_scenario_fan(
    scenario_id: UUID,
    num_samples: int = Query(default=50, ge=10, le=200),
) -> ScenarioFanResponse:
    """Generate Monte Carlo hazard realizations and evaluate passability distributions."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )

    scenario = SCENARIO_STORE[sid]
    g = build_live_graph(scenario, OBSERVATION_STORE.get(sid))

    t0 = time.perf_counter()
    bundle = sample_hazard_scenarios(
        g=g,
        num_samples=num_samples,
        random_seed=scenario.solver_parameters.random_seed,
    )
    sampling_duration_ms = max(1, int((time.perf_counter() - t0) * 1000))

    # Compute network-wide passability realization rate per sample
    realization_rates: list[float] = []
    num_edges = max(1, len(bundle.edge_ids))
    for i in range(bundle.num_samples):
        passable_count = int(bundle.realizations[i].sum())
        realization_rates.append(round(passable_count / num_edges, 3))

    realization_rates.sort()

    mean_p = float(sum(realization_rates) / max(1, len(realization_rates)))
    p05_idx = max(0, int(0.05 * len(realization_rates)))
    p95_idx = min(len(realization_rates) - 1, int(0.95 * len(realization_rates)))

    p05 = realization_rates[p05_idx]
    p95 = realization_rates[p95_idx]

    risk = _plan_risk_comparison(scenario, g, bundle, sid)

    return ScenarioFanResponse(
        scenario_id=scenario.scenario_id,
        num_samples=num_samples,
        mean_passability=round(mean_p, 3),
        worst_case_p05=round(p05, 3),
        best_case_p95=round(p95, 3),
        sampling_duration_ms=sampling_duration_ms,
        sample_survival_rates=realization_rates,
        deterministic_loss=risk[0],
        recourse_loss=risk[1],
        expected_shortfall_95=risk[2],
    )


@router.get("/routes", response_model=RouteAlternativesResponse)
def get_route_alternatives(
    scenario_id: UUID,
    origin_id: str = Query(...),
    destination_id: str = Query(...),
    k: int = Query(default=3, ge=1, le=5),
    vehicle_id: str | None = Query(default=None),
) -> RouteAlternativesResponse:
    """Generate k-diverse alternative routes between an origin and destination."""
    sid = str(scenario_id)
    if sid not in SCENARIO_STORE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario {scenario_id} not found",
        )

    scenario = SCENARIO_STORE[sid]
    g = build_live_graph(scenario, OBSERVATION_STORE.get(sid))

    if origin_id not in g:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Origin node '{origin_id}' not found in scenario network",
        )
    if destination_id not in g:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Destination node '{destination_id}' not found in scenario network",
        )

    try:
        raw_routes = find_k_diverse_alternatives(g, source=origin_id, target=destination_id, k=k)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Failed to find route alternatives: {e}",
        ) from e

    dest_name = str(g.nodes[destination_id].get("name", destination_id))

    routes: list[RouteOption] = []
    for rank_idx, r in enumerate(raw_routes, start=1):
        travel_sec = float(r.get("travel_time_sec", 60.0))
        routes.append(
            RouteOption(
                rank=rank_idx,
                node_path=r.get("node_path", []),
                edge_path=r.get("edge_path", []),
                travel_time_min=round(travel_sec / 60.0, 1),
                survival_prob=round(float(r.get("survival_prob", 0.90)), 3),
                jaccard_overlap_with_primary=float(r.get("jaccard_overlap_with_primary", 1.0)),
                eta_inflation_pct=round(float(r.get("eta_inflation_pct", 0.0)), 1),
            )
        )

    return RouteAlternativesResponse(
        scenario_id=scenario.scenario_id,
        origin_id=origin_id,
        destination_id=destination_id,
        vehicle_id=vehicle_id,
        destination_name=dest_name,
        routes=routes,
    )
