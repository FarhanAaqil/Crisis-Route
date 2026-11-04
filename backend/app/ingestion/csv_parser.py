"""CSV data ingestion with per-row schema validation and quarantine buffer."""

import csv
import io
from pathlib import Path
from typing import Any

from app.ingestion.quarantine import IngestionReport, QuarantinedRecord, RowValidationError

VALID_ROAD_CLASSES = {
    "motorway",
    "trunk",
    "primary",
    "secondary",
    "tertiary",
    "residential",
    "unclassified",
    "track",
    "service",
}

VALID_STATUSES = {"passable", "impassable", "partially_blocked", "debris_cleared"}


def parse_road_edges_csv(
    file_content: str | bytes,
    file_name: str = "road_edges.csv",
    bbox: list[float] | None = None,
) -> tuple[list[dict[str, Any]], IngestionReport]:
    """Parse road network edges from CSV, quarantining malformed rows.

    Expected columns: edge_id, u_node, v_node, length_m, free_flow_sec,
    road_class, u_lon, u_lat, v_lon, v_lat, bridge, slope_pct.
    """
    if isinstance(file_content, bytes):
        text = file_content.decode("utf-8", errors="replace")
    else:
        text = file_content

    reader = csv.DictReader(io.StringIO(text))
    valid_edges: list[dict[str, Any]] = []
    report = IngestionReport()

    min_lon, min_lat, max_lon, max_lat = bbox if bbox else (-180.0, -90.0, 180.0, 90.0)

    for idx, row in enumerate(reader, start=1):
        report.total_rows += 1
        errors: list[RowValidationError] = []

        # 1. edge_id check
        edge_id = (row.get("edge_id") or "").strip()
        if not edge_id:
            errors.append(
                RowValidationError(
                    column="edge_id",
                    error_code="REQUIRED_FIELD_MISSING",
                    message="Missing edge_id",
                    invalid_value=row.get("edge_id"),
                )
            )

        u_node = (row.get("u_node") or "").strip()
        v_node = (row.get("v_node") or "").strip()
        if not u_node or not v_node:
            errors.append(
                RowValidationError(
                    column="nodes",
                    error_code="INVALID_TOPOLOGY",
                    message="u_node and v_node must both be present and non-empty",
                    invalid_value=f"u={u_node}, v={v_node}",
                )
            )

        # 2. length_m & free_flow_sec check
        try:
            length_m = float(row.get("length_m", 0.0))
            if length_m <= 0:
                raise ValueError("length must be positive")
        except (ValueError, TypeError) as err:
            errors.append(
                RowValidationError(
                    column="length_m",
                    error_code="INVALID_LENGTH",
                    message=f"length_m must be a positive float: {err}",
                    invalid_value=row.get("length_m"),
                )
            )
            length_m = 0.0

        try:
            free_flow_sec = float(row.get("free_flow_sec", 0.0))
            if free_flow_sec <= 0:
                raise ValueError("travel time must be positive")
        except (ValueError, TypeError) as err:
            errors.append(
                RowValidationError(
                    column="free_flow_sec",
                    error_code="INVALID_TRAVEL_TIME",
                    message=f"free_flow_sec must be a positive float: {err}",
                    invalid_value=row.get("free_flow_sec"),
                )
            )
            free_flow_sec = 0.0

        # 3. road class
        road_class = (row.get("road_class") or "unclassified").strip().lower()
        if road_class not in VALID_ROAD_CLASSES:
            errors.append(
                RowValidationError(
                    column="road_class",
                    error_code="UNKNOWN_ROAD_CLASS",
                    message=f"Unknown road_class '{road_class}'",
                    invalid_value=road_class,
                )
            )

        # 4. coordinate bounds check
        try:
            u_lon = float(row.get("u_lon", 0.0))
            u_lat = float(row.get("u_lat", 0.0))
            v_lon = float(row.get("v_lon", 0.0))
            v_lat = float(row.get("v_lat", 0.0))

            if not (min_lon <= u_lon <= max_lon and min_lat <= u_lat <= max_lat):
                errors.append(
                    RowValidationError(
                        column="u_coordinates",
                        error_code="COORDINATES_OUT_OF_BOUNDS",
                        message=f"Start node [{u_lon}, {u_lat}] outside bounding box",
                        invalid_value=f"[{u_lon}, {u_lat}]",
                    )
                )

            if not (min_lon <= v_lon <= max_lon and min_lat <= v_lat <= max_lat):
                errors.append(
                    RowValidationError(
                        column="v_coordinates",
                        error_code="COORDINATES_OUT_OF_BOUNDS",
                        message=f"End node [{v_lon}, {v_lat}] outside bounding box",
                        invalid_value=f"[{v_lon}, {v_lat}]",
                    )
                )
        except (ValueError, TypeError) as err:
            errors.append(
                RowValidationError(
                    column="coordinates",
                    error_code="COORDINATE_PARSE_ERROR",
                    message=f"Failed to parse coordinates as floats: {err}",
                    invalid_value="coordinate parsing error",
                )
            )
            u_lon, u_lat, v_lon, v_lat = 0.0, 0.0, 0.0, 0.0

        bridge = str(row.get("bridge", "false")).strip().lower() in {"true", "1", "yes"}
        slope_pct = float(row.get("slope_pct", 0.0) or 0.0)

        # Quarantine if any error detected
        if errors:
            report.quarantined_rows += 1
            report.quarantine_records.append(
                QuarantinedRecord(
                    file_name=file_name,
                    row_index=idx,
                    raw_data=dict(row),
                    errors=errors,
                )
            )
        else:
            report.valid_rows += 1
            valid_edges.append(
                {
                    "edge_id": edge_id,
                    "u_node": u_node,
                    "v_node": v_node,
                    "length_m": length_m,
                    "free_flow_sec": free_flow_sec,
                    "road_class": road_class,
                    "u_coord": [u_lon, u_lat],
                    "v_coord": [v_lon, v_lat],
                    "bridge": bridge,
                    "slope_pct": slope_pct,
                }
            )

    return valid_edges, report


def parse_csv_file(
    file_path: str | Path,
    bbox: list[float] | None = None,
) -> tuple[list[dict[str, Any]], IngestionReport]:
    """Parse road edges CSV from disk."""
    path = Path(file_path)
    with open(path, "rb") as f:
        content = f.read()
    return parse_road_edges_csv(content, file_name=path.name, bbox=bbox)
