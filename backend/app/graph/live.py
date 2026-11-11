"""Scenario graph with the latest field observations folded in."""

import networkx as nx

from app.domain.models import ObservationResponse, ScenarioDetail
from app.domain.observations import ObservationGraphManager
from app.graph.build import build_scenario_corridor_graph


def build_live_graph(
    scenario: ScenarioDetail,
    observations: list[ObservationResponse],
) -> nx.DiGraph:
    """Build the scenario corridor graph and apply every stored observation to it."""
    graph = build_scenario_corridor_graph(scenario)
    if observations:
        graph, _, _ = ObservationGraphManager.apply_observations(graph, observations)
    return graph
