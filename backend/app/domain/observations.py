"""Dynamic observation processor, conflict detector, and graph versioning engine.

Field reports are folded into each edge's passability as evidence in log-odds space. Reports are
grouped per edge, weighted by source credibility and decayed by age, so the order they arrive in
does not matter and a stale report never outweighs a fresh one.
"""

import math
from collections import defaultdict
from datetime import UTC, datetime

import networkx as nx

from app.domain.models import ObservationResponse, ObservationStatus
from app.graph.store import compute_graph_hash

# Evidence strength per report type: positive pushes towards passable, negative towards blocked.
_EVIDENCE_LOGIT: dict[ObservationStatus, float] = {
    ObservationStatus.IMPASSABLE: -4.0,
    ObservationStatus.PARTIALLY_BLOCKED: -2.0,
    ObservationStatus.PASSABLE: 2.5,
    ObservationStatus.DEBRIS_CLEARED: 2.0,
}
_BLOCKED = {ObservationStatus.IMPASSABLE, ObservationStatus.PARTIALLY_BLOCKED}
_OPEN = {ObservationStatus.PASSABLE, ObservationStatus.DEBRIS_CLEARED}

HALF_LIFE_HOURS = 6.0
CONFLICT_MIN_CREDIBILITY = 0.5
MIN_PROB, MAX_PROB = 0.01, 0.99


def _logit(p: float) -> float:
    p = min(max(p, 1e-4), 1.0 - 1e-4)
    return math.log(p / (1.0 - p))


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _age_hours(obs: ObservationResponse, now: datetime) -> float:
    ts = obs.timestamp if obs.timestamp.tzinfo else obs.timestamp.replace(tzinfo=UTC)
    return max(0.0, (now - ts).total_seconds() / 3600.0)


class ObservationGraphManager:
    """Applies field observations to road graphs and tracks version transitions."""

    @staticmethod
    def detect_conflicts(observations: list[ObservationResponse]) -> bool:
        """True if credible reports on the SAME edge contradict each other.

        Callers may pass reports for many edges; they are grouped by edge first so a report that
        a road is open somewhere never conflicts with one that another road is blocked.
        """
        by_edge: dict[str, set[ObservationStatus]] = defaultdict(set)
        for obs in observations:
            if obs.source_credibility >= CONFLICT_MIN_CREDIBILITY:
                by_edge[obs.edge_id].add(obs.status)
        return any(statuses & _OPEN and statuses & _BLOCKED for statuses in by_edge.values())

    @classmethod
    def apply_observations(
        cls,
        base_graph: nx.DiGraph,
        observations: list[ObservationResponse],
        now: datetime | None = None,
    ) -> tuple[nx.DiGraph, str, set[str]]:
        """Fold every observation into one cloned graph.

        Returns:
            (new_versioned_graph, new_graph_hash, ids_of_conflicted_edges)
        """
        now = now or datetime.now(UTC)
        new_g = base_graph.copy()
        edge_lookup = {
            data.get("edge_id"): (u, v)
            for u, v, data in new_g.edges(data=True)
            if "edge_id" in data
        }

        grouped: dict[str, list[ObservationResponse]] = defaultdict(list)
        for obs in observations:
            if obs.edge_id in edge_lookup:
                grouped[obs.edge_id].append(obs)

        conflicted: set[str] = set()
        for edge_id, reports in grouped.items():
            u, v = edge_lookup[edge_id]
            attrs = new_g[u][v]
            prior = float(attrs.get("passability_prob", 0.9))

            evidence = 0.0
            for obs in reports:
                decay = 0.5 ** (_age_hours(obs, now) / HALF_LIFE_HOURS)
                evidence += _EVIDENCE_LOGIT[obs.status] * obs.source_credibility * decay
            posterior = _sigmoid(_logit(prior) + evidence)

            if cls.detect_conflicts(reports):
                conflicted.add(edge_id)
                # Contradictory credible reports: pull the estimate halfway back to "unknown"
                posterior = 0.5 + (posterior - 0.5) * 0.5

            latest = max(reports, key=lambda o: o.timestamp)
            attrs["passability_prob"] = round(min(MAX_PROB, max(MIN_PROB, posterior)), 4)
            attrs["stale_age_hours"] = round(_age_hours(latest, now), 3)
            attrs["is_conflicted"] = edge_id in conflicted
            attrs["last_observation_status"] = latest.status.value
            attrs["observation_count"] = len(reports)

        return new_g, compute_graph_hash(new_g), conflicted

    @classmethod
    def apply_observation_to_graph(
        cls,
        base_graph: nx.DiGraph,
        observation: ObservationResponse,
        existing_observations: list[ObservationResponse] | None = None,
    ) -> tuple[nx.DiGraph, str, bool]:
        """Apply a new observation (plus any earlier ones) to a cloned copy of the base graph.

        Returns:
            (new_versioned_graph, new_graph_hash, is_conflicted)
        """
        history = [o for o in (existing_observations or []) if o.edge_id == observation.edge_id]
        new_g, new_hash, conflicted = cls.apply_observations(base_graph, [*history, observation])
        return new_g, new_hash, observation.edge_id in conflicted

    @staticmethod
    def check_route_invalidated(
        chosen_paths: list[list[str]],
        impassable_edges: set[str],
    ) -> bool:
        """Check if any currently planned vehicle route contains an edge now reported blocked."""
        for path in chosen_paths:
            for edge_id in path:
                if edge_id in impassable_edges:
                    return True
        return False
