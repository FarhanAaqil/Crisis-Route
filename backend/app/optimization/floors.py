"""Minimum service floor constraints for protected demand groups."""

import math
from typing import Any

from ortools.sat.python import cp_model

from app.domain.groups import is_protected_group
from app.domain.models import ScenarioDetail


def required_floor_units(scenario: ScenarioDetail) -> dict[tuple[str, str], int]:
    """Units each protected node must receive per commodity: floor(alpha * demand)."""
    alpha = scenario.equity_parameters.min_group_service_floor_alpha
    floors: dict[tuple[str, str], int] = {}
    if alpha <= 0.0:
        return floors
    for node in scenario.demand_nodes:
        if not is_protected_group(node.vulnerable_group):
            continue
        for cid, req in node.demand.items():
            target = int(math.floor(alpha * req + 1e-9))
            if target > 0:
                floors[(node.id, cid)] = target
    return floors


def add_group_floors(
    model: cp_model.CpModel,
    scenario: ScenarioDetail,
    x_vars: dict[tuple[str, str, str, str], Any],
) -> list[str]:
    """Constrain every protected node to receive its floor of each commodity.

    Returns explanations for floors that can never be met because no delivery variable exists
    (no reachable depot holding that commodity), so the caller can report them instead of
    silently skipping the guarantee.
    """
    problems: list[str] = []
    for (node_id, cid), target in required_floor_units(scenario).items():
        terms = [var for (_, nid, c, _), var in x_vars.items() if nid == node_id and c == cid]
        if not terms:
            problems.append(
                f"Protected node '{node_id}' needs at least {target} units of '{cid}' but no "
                f"reachable depot can supply that commodity."
            )
            continue
        model.add(sum(terms) >= target)
    return problems
