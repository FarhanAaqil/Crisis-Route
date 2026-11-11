"""Single source of truth for which demand groups are protected, and how heavily they weigh.

Scenarios name their groups freely ("tribal_hamlet", "elderly_cluster", ...). The solver, the
diagnostics, the equity metrics and the graph builder must all agree on what is protected, so
they all go through this module.
"""

# Groups that carry no extra protection or weight.
GENERAL_GROUPS: frozenset[str] = frozenset({"general_population", "general_evacuees", "general"})

_EXPLICIT_WEIGHTS: dict[str, float] = {
    "pediatric_refuge": 2.0,
    "children_hospital": 2.0,
    "elderly_clinic": 1.7,
    "geriatric_home": 1.7,
    "isolated_hamlet": 1.5,
    "flood_evacuation_camp": 1.4,
    "tea_plantation_workers": 1.2,
    "hill_pilgrims_and_locals": 1.2,
    "displaced_farmers": 1.2,
}

# Ordered most to least severe; the first matching keyword wins.
_KEYWORD_WEIGHTS: tuple[tuple[str, float], ...] = (
    ("child", 2.0),
    ("pediatric", 2.0),
    ("infant", 2.0),
    ("pregnan", 1.8),
    ("patient", 1.8),
    ("disab", 1.8),
    ("elder", 1.7),
    ("geriatric", 1.7),
    ("tribal", 1.5),
    ("hamlet", 1.5),
    ("isolated", 1.5),
    ("remote", 1.5),
)


def normalize_group(group: str) -> str:
    return group.strip().lower()


def get_vulnerability_weight(group: str) -> float:
    """Priority multiplier for a demand group (1.0 means no extra protection)."""
    key = normalize_group(group)
    if key in GENERAL_GROUPS:
        return 1.0
    if key in _EXPLICIT_WEIGHTS:
        return _EXPLICIT_WEIGHTS[key]
    for keyword, weight in _KEYWORD_WEIGHTS:
        if keyword in key:
            return weight
    return 1.0


def is_protected_group(group: str) -> bool:
    """True when the group is entitled to the minimum service floor."""
    return get_vulnerability_weight(group) > 1.0
