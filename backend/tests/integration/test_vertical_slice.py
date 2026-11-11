"""End-to-End Vertical Slice Integration Test for Phase 4 MVP Gate.

Validates the full pipeline:
Ingestion -> Passability -> Risk Routing -> CP-SAT Allocation -> Human Approval -> Export.
Verifies commodity conservation and non-negativity mathematical invariants.
"""

import json

from app.domain.models import UserRole
from app.ingestion.geojson_parser import parse_geojson_features
from app.ingestion.snapshots import snapshot_repository
from tests.helpers import auth_headers, make_client


def test_full_operational_vertical_slice_e2e():
    """Verify entire humanitarian relief lifecycle end-to-end across all subsystem gates."""
    client = make_client()
    analyst_headers = auth_headers(UserRole.ANALYST.value, "analyst-lead")
    approver_headers = auth_headers(UserRole.APPROVER.value, "district-collector", "Farhan Aaqil")

    # -------------------------------------------------------------------------
    # Step 1: Ingestion & Snapshot
    # -------------------------------------------------------------------------
    raw_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[76.0825, 11.6080], [76.1000, 11.6200]],
                },
                "properties": {
                    "edge_id": "WAYANAD_TRUNK_01",
                    "road_class": "trunk",
                    "length_m": 2500.0,
                    "free_flow_sec": 180.0,
                    "bridge": False,
                    "slope_pct": 2.1,
                },
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[76.1000, 11.6200], [76.1280, 11.5510]],
                },
                "properties": {
                    "edge_id": "MEPPADI_ACCESS_02",
                    "road_class": "primary",
                    "length_m": 4200.0,
                    "free_flow_sec": 360.0,
                    "bridge": True,
                    "slope_pct": 7.5,
                },
            },
        ],
    }

    valid_edges, report = parse_geojson_features(json.dumps(raw_geojson))
    assert len(valid_edges) == 2
    assert report.quarantined_rows == 0

    snapshot = snapshot_repository.create_snapshot(
        region_name="Wayanad-Periyar Relief Corridor",
        bbox=[75.90, 11.45, 76.40, 11.95],
        road_edges=valid_edges,
        depots=[],
        demand_nodes=[],
        vehicles=[],
    )
    assert len(snapshot.metadata.snapshot_id) == 64

    # -------------------------------------------------------------------------
    # Step 2: Initialize Scenario with >= 5 Demand Points & 2 Depots
    # -------------------------------------------------------------------------
    scenarios_res = client.get("/api/v1/scenarios")
    assert scenarios_res.status_code == 200
    scenarios = scenarios_res.json()
    assert len(scenarios) > 0
    sid = scenarios[0]["scenario_id"]

    # Add 5th demand node to guarantee Exit Criterion 1 (>= 5 demand nodes, >= 2 depots)
    fifth_node = {
        "id": "NODE-MEPPADI-TRIBAL-CLINIC",
        "name": "Meppadi Tribal Health Sub-Center",
        "vulnerable_group": "pediatric_refuge",
        "population": 180,
        "coordinates": [76.115, 11.562],
        "demand": {
            "COM-WATER-10L": 100,
            "COM-MRE-RATIONS": 200,
            "COM-MED-TRAUMA": 50,
            "COM-SHELTER-TARPS": 40,
        },
    }
    add_res = client.post(
        f"/api/v1/scenarios/{sid}/resources/demand-nodes",
        json=fifth_node,
        headers=analyst_headers,
    )
    assert add_res.status_code == 201

    res_check = client.get(f"/api/v1/scenarios/{sid}/resources")
    assert res_check.status_code == 200
    res_data = res_check.json()
    assert len(res_data["depots"]) >= 2
    assert len(res_data["demand_nodes"]) >= 5

    # -------------------------------------------------------------------------
    # Step 3: Register Field Observation
    # -------------------------------------------------------------------------
    obs_payload = {
        "edge_id": "MEPPADI_ACCESS_02",
        "status": "partially_blocked",
        "source_type": "field_patrol",
        "source_credibility": 0.85,
        "confidence_interval": [0.4, 0.7],
        "water_depth_cm": 15.0,
        "reported_by": "kerala_fire_rescue_unit_04",
        "notes": "Partial mudflow on approach road, 4WD vehicles navigable with caution",
    }
    obs_res = client.post(
        f"/api/v1/scenarios/{sid}/observations",
        json=obs_payload,
        headers=analyst_headers,
    )
    assert obs_res.status_code == 201

    # -------------------------------------------------------------------------
    # Step 4: Run CP-SAT Robust Optimization
    # -------------------------------------------------------------------------
    opt_res = client.post(
        f"/api/v1/scenarios/{sid}/plans/optimize?mode=robust",
        headers=analyst_headers,
    )
    assert opt_res.status_code == 201
    plan = opt_res.json()

    assert plan["solver_status"] in ["OPTIMAL", "FEASIBLE"]
    assert len(plan["allocations"]) > 0
    assert len(plan["vehicle_routes"]) > 0
    assert plan["equity_evaluation"]["alpha_floor_satisfied"] is True
    plan_id = plan["plan_id"]

    # -------------------------------------------------------------------------
    # Step 5: Verify Mathematical Invariants (Commodity Conservation & Non-Negativity)
    # -------------------------------------------------------------------------
    total_stock_by_com: dict[str, int] = res_data["total_supply_by_commodity"]
    total_delivered_by_com: dict[str, int] = {}

    for alloc in plan["allocations"]:
        cid = alloc["commodity_id"]
        qty = alloc["quantity_delivered"]
        # Non-negativity
        assert qty >= 0, f"Delivery quantity for {cid} must be non-negative: {qty}"
        total_delivered_by_com[cid] = total_delivered_by_com.get(cid, 0) + qty

    # Supply Conservation: delivered <= total stock
    for cid, deliv_qty in total_delivered_by_com.items():
        stock_qty = total_stock_by_com.get(cid, 0)
        assert deliv_qty <= stock_qty, (
            f"Supply conservation violated for {cid}: delivered {deliv_qty} > stock {stock_qty}"
        )

    # Demand Conservation: delivered + unmet == total demand
    total_demand_by_com: dict[str, int] = res_data["total_demand_by_commodity"]
    total_unmet_by_com: dict[str, int] = {}
    for unmet in plan["unmet_demands"]:
        cid = unmet["commodity_id"]
        u_qty = unmet["unmet_quantity"]
        assert u_qty >= 0, f"Unmet quantity for {cid} must be non-negative: {u_qty}"
        total_unmet_by_com[cid] = total_unmet_by_com.get(cid, 0) + u_qty

    for cid, req_qty in total_demand_by_com.items():
        deliv = total_delivered_by_com.get(cid, 0)
        unmet = total_unmet_by_com.get(cid, 0)
        assert deliv + unmet == req_qty, (
            f"Demand conservation violated for {cid}: {deliv} + {unmet} != {req_qty}"
        )

    # -------------------------------------------------------------------------
    # Step 6: Incident Lead Sign-Off Gate
    # -------------------------------------------------------------------------
    approval_payload = {
        "decision": "APPROVE",
        "rationale": "Field clearance confirmed on Meppadi corridor. Fleet dispatch authorized.",
    }
    appr_res = client.post(
        f"/api/v1/scenarios/plans/{plan_id}/approval",
        json=approval_payload,
        headers=approver_headers,
    )
    assert appr_res.status_code == 200
    approved_plan = appr_res.json()
    assert approved_plan["approval_state"]["status"] == "APPROVED"
    assert approved_plan["approval_state"]["reviewed_by"] == "Farhan Aaqil"

    # -------------------------------------------------------------------------
    # Step 7: Export Manifest
    # -------------------------------------------------------------------------
    export_res = client.get(
        f"/api/v1/scenarios/{sid}/plans/{plan_id}/export",
        headers=analyst_headers,
    )
    assert export_res.status_code == 200
    export_manifest = export_res.json()
    assert export_manifest["export_format"] == "CrisisRoute-Plan-v1"
    assert export_manifest["plan_id"] == plan_id
    assert export_manifest["approval_state"]["status"] == "APPROVED"
