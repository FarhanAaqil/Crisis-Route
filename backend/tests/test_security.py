"""Authentication, throttling, CORS, upload limits, audit chain integrity and durable state."""

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings, settings
from app.domain.models import ScenarioDetail, UserRole
from app.main import app
from app.persistence.audit_ledger import AuditLedger
from app.persistence.json_store import ListStore, ModelStore
from app.security import auth
from app.security.auth import create_access_token
from app.security.users import DEMO_PASSWORD, hash_password, verify_password
from tests.helpers import auth_headers

anon = TestClient(app)


def _scenario_id() -> str:
    token = auth_headers(UserRole.ANALYST)
    return str(anon.get("/api/v1/scenarios", headers=token).json()[0]["scenario_id"])


def test_protected_routes_reject_anonymous_callers():
    assert anon.get("/api/v1/scenarios").status_code == 401
    assert anon.get("/api/v1/audit").status_code == 401
    assert anon.post("/api/v1/ingest/upload", data={"raw_content": "a,b"}).status_code == 401


def test_health_stays_public():
    assert anon.get("/api/v1/health").status_code == 200


def test_identity_headers_are_ignored_without_a_token():
    sid = _scenario_id()
    res = anon.post(
        f"/api/v1/scenarios/{sid}/approve",
        json={"decision": "APPROVE", "rationale": "forged approval attempt"},
        headers={"X-User-Role": "approver", "X-User-Id": "attacker"},
    )
    assert res.status_code == 401


def test_token_signed_with_wrong_secret_is_rejected():
    forged = jwt.encode(
        {"sub": "evil", "role": "admin", "exp": 4102444800},
        "another-secret-value-that-is-32-bytes!!",
        "HS256",
    )
    res = anon.get("/api/v1/scenarios", headers={"Authorization": f"Bearer {forged}"})
    assert res.status_code == 401


def test_expired_token_is_rejected():
    token = create_access_token("u1", "User One", UserRole.ANALYST, expires_minutes=-5)
    res = anon.get("/api/v1/scenarios", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert "expired" in res.json()["detail"].lower()


def test_role_claim_cannot_be_escalated_by_header():
    headers = auth_headers(UserRole.ANALYST) | {"X-User-Role": "approver"}
    sid = _scenario_id()
    res = anon.post(
        f"/api/v1/scenarios/{sid}/approve",
        json={"decision": "APPROVE", "rationale": "analyst trying to self-approve"},
        headers=headers,
    )
    assert res.status_code == 403


def test_login_issues_working_token_and_rejects_bad_password():
    ok = anon.post("/api/v1/auth/login", json={"username": "approver", "password": DEMO_PASSWORD})
    assert ok.status_code == 200
    body = ok.json()
    assert body["user"]["role"] == "approver"
    me = anon.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["role"] == "approver"

    bad = anon.post("/api/v1/auth/login", json={"username": "approver", "password": "wrong"})
    assert bad.status_code == 401
    unknown = anon.post("/api/v1/auth/login", json={"username": "nobody", "password": "x"})
    assert unknown.status_code == 401
    assert unknown.json()["detail"] == bad.json()["detail"]


def test_repeated_failed_logins_are_throttled(monkeypatch):
    monkeypatch.setattr(settings, "login_max_failures", 3)
    auth._FAILED_LOGINS.clear()
    for _ in range(3):
        assert (
            anon.post(
                "/api/v1/auth/login", json={"username": "field", "password": "nope"}
            ).status_code
            == 401
        )
    locked = anon.post("/api/v1/auth/login", json={"username": "field", "password": DEMO_PASSWORD})
    assert locked.status_code == 429
    assert "Retry-After" in locked.headers
    auth._FAILED_LOGINS.clear()


def test_password_hashing_round_trip():
    stored = hash_password("s3cret")
    assert stored.startswith("scrypt$")
    assert verify_password("s3cret", stored)
    assert not verify_password("S3cret", stored)
    assert not verify_password("s3cret", "garbage")


def test_production_refuses_to_start_without_a_strong_secret():
    with pytest.raises(ValueError):
        Settings(environment="production", jwt_secret_key=None, _env_file=None)  # type: ignore[call-arg]
    with pytest.raises(ValueError):
        Settings(environment="production", jwt_secret_key="short", _env_file=None)  # type: ignore[call-arg]
    ok = Settings(environment="production", jwt_secret_key="x" * 40, _env_file=None)  # type: ignore[call-arg]
    assert ok.is_production


def test_cors_only_allows_configured_origins():
    allowed = settings.cors_origin_list[0]
    good = anon.options(
        "/api/v1/scenarios",
        headers={"Origin": allowed, "Access-Control-Request-Method": "GET"},
    )
    assert good.headers.get("access-control-allow-origin") == allowed
    bad = anon.options(
        "/api/v1/scenarios",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert "access-control-allow-origin" not in bad.headers


def test_oversized_uploads_are_rejected(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_bytes", 64)
    res = anon.post(
        "/api/v1/ingest/upload",
        files={"file": ("big.csv", b"x" * 500, "text/csv")},
        headers=auth_headers(UserRole.ANALYST),
    )
    assert res.status_code == 413


def test_responses_carry_security_headers():
    res = anon.get("/api/v1/health")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert res.headers["x-correlation-id"]


def test_audit_chain_detects_tampering(tmp_path):
    ledger = AuditLedger(tmp_path / "audit.jsonl")
    for i in range(3):
        ledger.append("u1", f"ACTION_{i}", "plan", f"p{i}", {"n": i})
    assert ledger.verify()

    reloaded = AuditLedger(tmp_path / "audit.jsonl")
    assert len(reloaded.events()) == 3 and reloaded.verify()

    reloaded.events()[1].details["n"] = 999  # events() copies the list, not the models
    assert not reloaded.verify()


def test_audit_chain_detects_removed_event(tmp_path):
    ledger = AuditLedger(None)
    for i in range(3):
        ledger.append("u1", "A", "plan", str(i), {})
    del ledger._events[1]
    assert not ledger.verify()


def test_scenarios_and_observations_survive_a_restart(tmp_path):
    scenario = ScenarioDetail.model_validate(
        anon.get(
            "/api/v1/scenarios/" + _scenario_id(), headers=auth_headers(UserRole.ANALYST)
        ).json()
    )
    store = ModelStore(ScenarioDetail, tmp_path / "scenarios")
    key = str(scenario.scenario_id)
    store[key] = scenario
    scenario.name = "Edited after save"
    store.save(key)

    restarted = ModelStore(ScenarioDetail, tmp_path / "scenarios")
    assert restarted[key].name == "Edited after save"
    del restarted[key]
    assert key not in ModelStore(ScenarioDetail, tmp_path / "scenarios")


def test_observation_list_store_round_trip(tmp_path):
    from app.domain.models import ObservationResponse, ObservationStatus

    store = ListStore(ObservationResponse, tmp_path / "obs")
    store.append("s1", ObservationResponse(edge_id="E1", status=ObservationStatus.IMPASSABLE))
    store.append("s1", ObservationResponse(edge_id="E2", status=ObservationStatus.PASSABLE))
    again = ListStore(ObservationResponse, tmp_path / "obs")
    assert [o.edge_id for o in again.get("s1")] == ["E1", "E2"]
    assert again.get("missing") == []
