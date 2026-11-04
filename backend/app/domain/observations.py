"""Dynamic observation processor, conflict detector, and graph versioning engine."""

import networkx as nx

from app.domain.models import ObservationResponse, ObservationStatus
from app.graph.store import compute_graph_hash


class ObservationGraphManager:
    """Applies field observations to road graphs and tracks version transitions."""

    @staticmethod
    def detect_conflicts(observations: list[ObservationResponse]) -> bool:
        """Return True if observations on an edge contain contradictory status reports."""
        statuses = {obs.status for obs in observations}
        has_open = (
            ObservationStatus.PASSABLE in statuses or ObservationStatus.DEBRIS_CLEARED in statuses
        )
        has_blocked = (
            ObservationStatus.IMPASSABLE in statuses
            or ObservationStatus.PARTIALLY_BLOCKED in statuses
        )
        return bool(has_open and has_blocked)

    @classmethod
    def apply_observation_to_graph(
        cls,
        base_graph: nx.DiGraph,
        observation: ObservationResponse,
        existing_observations: list[ObservationResponse] | None = None,
    ) -> tuple[nx.DiGraph, str, bool]:
        """Apply new observation to a cloned copy of the base graph.

        Returns:
            (new_versioned_graph, new_graph_hash, is_conflicted)
        """
        # Create a deep copy to preserve immutability of parent graph version
        new_g = base_graph.copy()
        edge_id = observation.edge_id

        all_obs = (existing_observations or []) + [observation]
        is_conflicted = cls.detect_conflicts(all_obs)

        # Locate edge in graph
        target_edge = None
        for u, v, data in new_g.edges(data=True):
            if data.get("edge_id") == edge_id:
                target_edge = (u, v)
                break

        if target_edge:
            u, v = target_edge
            credibility = observation.source_credibility

            if observation.status in [
                ObservationStatus.IMPASSABLE,
                ObservationStatus.PARTIALLY_BLOCKED,
            ]:
                # Reduce passability probability based on credibility
                new_prob = max(0.01, 1.0 - (0.90 * credibility))
            else:
                new_prob = min(0.99, 0.50 + (0.45 * credibility))

            if is_conflicted:
                # Widen probability towards uncertainty under contradiction
                new_prob = 0.50

            new_g[u][v]["passability_prob"] = round(new_prob, 4)
            new_g[u][v]["stale_age_hours"] = 0.0  # Freshly observed
            new_g[u][v]["is_conflicted"] = is_conflicted
            new_g[u][v]["last_observation_status"] = observation.status.value

        new_hash = compute_graph_hash(new_g)
        return new_g, new_hash, is_conflicted

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
