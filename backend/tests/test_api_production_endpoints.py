"""Integration tests for production passability, intelligence, and ingestion endpoints."""

from app.api.scenarios import seed_canonical_scenario
from tests.helpers import make_client

client = make_client()


def test_passability_endpoint_returns_network_and_calibration():
    scenario = seed_canonical_scenario()
    sid = str(scenario.scenario_id)

    res = client.get(f"/api/v1/scenarios/{sid}/passability")
    assert res.status_code == 200
    data = res.json()

    assert data["scenario_id"] == sid
    assert len(data["edges"]) > 0
    assert len(data["nodes"]) > 0

    # Verify edge schema
    sample_edge = data["edges"][0]
    assert "edge_id" in sample_edge
    assert "u_coord" in sample_edge and len(sample_edge["u_coord"]) == 2
    assert "v_coord" in sample_edge and len(sample_edge["v_coord"]) == 2
    assert sample_edge["risk_class"] in ["PASSABLE", "MODERATE", "CRITICAL"]
    assert len(sample_edge["credible_interval"]) == 2

    # Verify calibration metrics
    cal = data["calibration_metrics"]
    assert cal["brier_score"] <= 0.15
    assert cal["expected_calibration_error"] <= 0.05
    assert len(cal["reliability_diagram"]) == 10

    # Verify summary
    summary = data["summary"]
    assert summary["total_edges"] == len(data["edges"])
    classified = summary["passable_count"] + summary["moderate_count"] + summary["critical_count"]
    assert classified == len(data["edges"])


def test_voi_rankings_endpoint():
    scenario = seed_canonical_scenario()
    sid = str(scenario.scenario_id)

    res = client.get(f"/api/v1/scenarios/{sid}/voi-rankings?top_k=5")
    assert res.status_code == 200
    data = res.json()

    assert data["scenario_id"] == sid
    assert len(data["targets"]) > 0
    assert len(data["targets"]) <= 5

    # Check top ranking has rank 1 and highest VoI
    top = data["targets"][0]
    assert top["priority_rank"] == 1
    assert top["voi_score"] > 0
    assert top["expected_regret_reduction"] >= 0


def test_scenario_fan_endpoint():
    scenario = seed_canonical_scenario()
    sid = str(scenario.scenario_id)

    res = client.get(f"/api/v1/scenarios/{sid}/scenario-fan?num_samples=25")
    assert res.status_code == 200
    data = res.json()

    assert data["scenario_id"] == sid
    assert data["num_samples"] == 25
    assert 0.0 <= data["worst_case_p05"] <= data["mean_passability"] <= data["best_case_p95"] <= 1.0
    assert len(data["sample_survival_rates"]) == 25


def test_routes_endpoint():
    scenario = seed_canonical_scenario()
    sid = str(scenario.scenario_id)
    depot_id = scenario.depots[0].id
    demand_id = scenario.demand_nodes[0].id

    res = client.get(
        f"/api/v1/scenarios/{sid}/routes?origin_id={depot_id}&destination_id={demand_id}&k=2"
    )
    assert res.status_code == 200
    data = res.json()

    assert data["scenario_id"] == sid
    assert data["origin_id"] == depot_id
    assert data["destination_id"] == demand_id
    assert len(data["routes"]) >= 1

    primary = data["routes"][0]
    assert primary["rank"] == 1
    assert primary["travel_time_min"] > 0
    assert primary["survival_prob"] > 0


def test_ingest_upload_csv_with_quarantine():
    # CSV content with 2 valid rows and 1 malformed row
    csv_payload = (
        "edge_id,u_node,v_node,length_m,free_flow_sec,road_class,bridge,passability_prob\n"
        "EDGE-TEST-01,U1,V1,1200.0,90.0,primary,false,0.92\n"
        "EDGE-TEST-02,U2,V2,800.0,60.0,secondary,true,0.75\n"
        "EDGE-BAD-01,U3,V3,-50.0,-10.0,tertiary,false,1.8\n"
    )

    res = client.post(
        "/api/v1/ingest/upload",
        data={"raw_content": csv_payload, "file_name": "test_road_network.csv"},
    )
    assert res.status_code == 200
    data = res.json()

    assert data["file_name"] == "test_road_network.csv"
    assert data["total_rows"] == 3
    assert data["valid_rows"] == 2
    assert data["quarantined_rows"] == 1
    assert len(data["quarantine_records"]) == 1
    assert len(data["snapshot_hash"]) == 64
    assert len(data["valid_edges_preview"]) == 2
