"""Compression, caching, pagination, SPA serving and edit-invalidation behaviour."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.audit import router as _audit_router  # noqa: F401  (ensures routers import cleanly)
from app.api.intelligence import _ROUTES_CACHE, _VOI_CACHE
from app.api.passability import _PASSABILITY_CACHE
from app.core.cache import ResponseCache
from app.domain.models import UserRole
from app.main import SPAStaticFiles
from tests.helpers import auth_headers, make_client

client = make_client(UserRole.ANALYST)


def _sid() -> str:
    return client.get("/api/v1/scenarios").json()[0]["scenario_id"]


def test_large_json_is_gzip_compressed():
    res = client.get(f"/api/v1/scenarios/{_sid()}/passability", headers={"Accept-Encoding": "gzip"})
    assert res.status_code == 200
    assert res.headers.get("content-encoding") == "gzip"


def test_passability_is_cached_until_state_changes():
    sid = _sid()
    client.get(f"/api/v1/scenarios/{sid}/passability")
    hits = _PASSABILITY_CACHE.hits
    client.get(f"/api/v1/scenarios/{sid}/passability")
    assert _PASSABILITY_CACHE.hits == hits + 1

    edge_id = client.get(f"/api/v1/scenarios/{sid}/passability").json()["edges"][0]["edge_id"]
    posted = client.post(
        f"/api/v1/scenarios/{sid}/observations",
        json={"edge_id": edge_id, "status": "impassable", "source_credibility": 0.9},
        headers=auth_headers(UserRole.FIELD_ANALYST),
    )
    assert posted.status_code == 201
    misses = _PASSABILITY_CACHE.misses
    fresh = client.get(f"/api/v1/scenarios/{sid}/passability").json()
    assert _PASSABILITY_CACHE.misses == misses + 1  # new observation => new key
    updated = next(e for e in fresh["edges"] if e["edge_id"] == edge_id)
    assert updated["passability_prob"] < 0.5


def test_voi_and_route_endpoints_use_the_cache():
    sid = _sid()
    nodes = client.get(f"/api/v1/scenarios/{sid}/passability").json()["nodes"]
    depot = next(n["node_id"] for n in nodes if n["node_type"] == "depot")
    demand = next(n["node_id"] for n in nodes if n["node_type"] == "demand")
    url = f"/api/v1/scenarios/{sid}/routes?origin_id={depot}&destination_id={demand}&k=2"
    first = client.get(url + "&vehicle_id=A").json()
    hits = _ROUTES_CACHE.hits
    second = client.get(url + "&vehicle_id=B").json()
    assert _ROUTES_CACHE.hits == hits + 1
    assert first["routes"] == second["routes"]
    assert (first["vehicle_id"], second["vehicle_id"]) == ("A", "B")

    client.get(f"/api/v1/scenarios/{sid}/voi-rankings")
    hits = _VOI_CACHE.hits
    client.get(f"/api/v1/scenarios/{sid}/voi-rankings")
    assert _VOI_CACHE.hits == hits + 1


def test_response_cache_evicts_least_recently_used():
    cache: ResponseCache[int] = ResponseCache(2)
    for key in ("a", "b"):
        cache.get_or_compute(key, lambda: 1)
    cache.get_or_compute("a", lambda: 99)  # touch a
    cache.get_or_compute("c", lambda: 3)  # evicts b
    assert cache.get_or_compute("a", lambda: -1) == 1
    assert cache.get_or_compute("b", lambda: 2) == 2


def test_audit_and_observation_lists_are_paginated():
    sid = _sid()
    audit = client.get("/api/v1/audit?limit=2&offset=0")
    assert audit.status_code == 200 and len(audit.json()) <= 2
    assert int(audit.headers["x-total-count"]) >= len(audit.json())
    obs = client.get(f"/api/v1/scenarios/{sid}/observations?limit=1")
    assert obs.status_code == 200 and len(obs.json()) <= 1
    assert client.get(f"/api/v1/scenarios/{sid}/observations?limit=0").status_code == 422


def test_editing_resources_changes_the_snapshot_and_makes_plans_stale():
    sid = _sid()
    analyst = auth_headers(UserRole.ANALYST, "analyst-edit", "Edit Analyst")
    plan = client.post(f"/api/v1/scenarios/{sid}/plans/optimize", headers=analyst).json()
    client.post(f"/api/v1/scenarios/plans/{plan['plan_id']}/submit", headers=analyst)

    before = client.get(f"/api/v1/scenarios/{sid}").json()["snapshot_id"]
    node = client.get(f"/api/v1/scenarios/{sid}/resources").json()["demand_nodes"][0]
    node["population"] += 1
    edited = client.post(f"/api/v1/scenarios/{sid}/resources/demand-nodes", json=node)
    assert edited.status_code == 201
    assert client.get(f"/api/v1/scenarios/{sid}").json()["snapshot_id"] != before

    res = client.post(
        f"/api/v1/scenarios/plans/{plan['plan_id']}/approval",
        json={"decision": "APPROVE", "rationale": "Approving after the inputs changed."},
        headers=auth_headers(UserRole.APPROVER, "lead-edit", "Lead"),
    )
    assert res.status_code == 409


def test_spa_fallback_and_asset_cache_headers(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>app</html>", encoding="utf-8")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
    app = FastAPI()
    app.mount("/", SPAStaticFiles(directory=str(tmp_path), html=True))
    web = TestClient(app)

    page = web.get("/audit/some/client/route")
    assert page.status_code == 200 and "app" in page.text
    assert page.headers["cache-control"] == "no-cache"

    asset = web.get("/assets/app.js")
    assert "immutable" in asset.headers["cache-control"]
    assert web.get("/assets/missing.js").status_code == 404
