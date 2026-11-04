"""Integration tests for data ingestion, row quarantine, snapshots, and graph builds."""

import json

from app.graph.build import build_directed_graph, compute_graph_summary
from app.graph.store import compute_graph_hash, deserialize_graph, serialize_graph
from app.ingestion.csv_parser import parse_road_edges_csv
from app.ingestion.geojson_parser import parse_geojson_features
from app.ingestion.snapshots import SnapshotRepository


def test_csv_ingestion_with_quarantine():
    """Verify CSV parser accepts valid rows and redirects corrupted rows to quarantine."""
    header = (
        "edge_id,u_node,v_node,length_m,free_flow_sec,road_class,"
        "u_lon,u_lat,v_lon,v_lat,bridge,slope_pct"
    )
    csv_content = (
        f"{header}\n"
        """E_VALID_1,N1,N2,1200.0,90.0,primary,76.10,11.50,76.12,11.52,false,3.5
E_CORRUPT_LEN,N2,N3,-500.0,60.0,secondary,76.12,11.52,76.15,11.55,false,2.0
E_OUT_OF_BOUNDS,N3,N4,800.0,45.0,tertiary,85.00,20.00,85.02,20.02,false,1.0
E_VALID_2,N2,N1,1200.0,90.0,primary,76.12,11.52,76.10,11.50,false,3.5
"""
    )
    bbox = [76.0, 11.4, 76.5, 11.9]  # Wayanad corridor bounding box
    valid_edges, report = parse_road_edges_csv(csv_content, file_name="test.csv", bbox=bbox)

    assert report.total_rows == 4
    assert report.valid_rows == 2
    assert report.quarantined_rows == 2

    quarantined_codes = {err.error_code for q in report.quarantine_records for err in q.errors}
    assert "INVALID_LENGTH" in quarantined_codes
    assert "COORDINATES_OUT_OF_BOUNDS" in quarantined_codes

    assert len(valid_edges) == 2
    assert valid_edges[0]["edge_id"] == "E_VALID_1"
    assert valid_edges[1]["edge_id"] == "E_VALID_2"


def test_geojson_ingestion_with_quarantine():
    """Verify GeoJSON parser extracts LineStrings and quarantines invalid geometries."""
    geojson_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[76.10, 11.50], [76.12, 11.52]],
                },
                "properties": {"id": "GEO_VALID_1", "road_class": "primary"},
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[76.10, 11.50], [76.12]],  # Malformed coordinate pair
                },
                "properties": {"id": "GEO_CORRUPT_PAIR"},
            },
        ],
    }

    valid_features, report = parse_geojson_features(
        json.dumps(geojson_data),
        bbox=[76.0, 11.4, 76.5, 11.9],
    )

    assert report.total_rows == 2
    assert report.valid_rows == 1
    assert report.quarantined_rows == 1
    assert report.quarantine_records[0].errors[0].error_code == "MALFORMED_COORDINATE_PAIR"


def test_snapshot_determinism():
    """Verify that identical inputs deterministically yield identical SHA-256 snapshot hashes."""
    repo = SnapshotRepository()
    bbox = [76.0, 11.4, 76.5, 11.9]

    edges = [
        {"edge_id": "E1", "u_node": "N1", "v_node": "N2", "length_m": 500.0},
        {"edge_id": "E2", "u_node": "N2", "v_node": "N3", "length_m": 800.0},
    ]
    depots = [{"id": "D1", "name": "Main Depot", "coordinates": [76.1, 11.5]}]
    demand = [{"id": "DM1", "name": "Camp A", "coordinates": [76.2, 11.6]}]
    vehicles = [{"id": "V1", "name": "Truck 1", "capacity_kg": 3000.0}]

    snap1 = repo.create_snapshot("Wayanad", bbox, edges, depots, demand, vehicles)
    snap2 = repo.create_snapshot("Wayanad", bbox, edges, depots, demand, vehicles)

    assert snap1.metadata.snapshot_id == snap2.metadata.snapshot_id
    assert len(snap1.metadata.snapshot_id) == 64


def test_graph_construction_and_serialization():
    """Verify NetworkX directed graph build, topology metrics, and round-trip serialization."""
    edges = [
        {
            "edge_id": "E1",
            "u_node": "N1",
            "v_node": "N2",
            "length_m": 1000.0,
            "free_flow_sec": 60.0,
            "u_coord": [76.10, 11.50],
            "v_coord": [76.12, 11.52],
            "road_class": "primary",
        },
        {
            "edge_id": "E2",
            "u_node": "N2",
            "v_node": "N3",
            "length_m": 1500.0,
            "free_flow_sec": 90.0,
            "u_coord": [76.12, 11.52],
            "v_coord": [76.15, 11.55],
            "road_class": "secondary",
        },
        {
            "edge_id": "E3",
            "u_node": "N3",
            "v_node": "N1",
            "length_m": 2000.0,
            "free_flow_sec": 120.0,
            "u_coord": [76.15, 11.55],
            "v_coord": [76.10, 11.50],
            "road_class": "tertiary",
        },
    ]

    g = build_directed_graph(edges)
    summary = compute_graph_summary(g)

    assert summary["node_count"] == 3
    assert summary["edge_count"] == 3
    assert summary["total_length_km"] == 4.5
    assert summary["is_strongly_connected"] is True

    # Test cryptographic serialization
    serialized = serialize_graph(g, extra_metadata={"region": "Wayanad"})
    graph_hash = serialized["graph_hash"]
    assert len(graph_hash) == 64

    # Deserialize and verify round-trip integrity
    restored_g, restored_hash = deserialize_graph(serialized)
    assert restored_hash == graph_hash
    assert restored_g.number_of_nodes() == 3
    assert restored_g.number_of_edges() == 3
    assert compute_graph_hash(restored_g) == graph_hash
