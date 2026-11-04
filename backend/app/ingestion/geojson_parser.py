"""GeoJSON spatial parser with geometry validation and quarantine handler."""

import json
from pathlib import Path
from typing import Any

from app.ingestion.quarantine import IngestionReport, QuarantinedRecord, RowValidationError


def parse_geojson_features(
    file_content: str | bytes,
    file_name: str = "network.geojson",
    bbox: list[float] | None = None,
) -> tuple[list[dict[str, Any]], IngestionReport]:
    """Parse GeoJSON FeatureCollection, validating geometries and coordinates.

    Quarantines invalid geometries or out-of-bounds coordinates.
    """
    if isinstance(file_content, bytes):
        text = file_content.decode("utf-8", errors="replace")
    else:
        text = file_content

    report = IngestionReport()
    valid_features: list[dict[str, Any]] = []

    try:
        data = json.loads(text)
    except json.JSONDecodeError as err:
        report.total_rows = 1
        report.quarantined_rows = 1
        report.quarantine_records.append(
            QuarantinedRecord(
                file_name=file_name,
                row_index=1,
                raw_data={"raw_text_snippet": text[:200]},
                errors=[
                    RowValidationError(
                        column="root",
                        error_code="JSON_DECODE_ERROR",
                        message=f"Failed to parse JSON: {err}",
                    )
                ],
            )
        )
        return valid_features, report

    if data.get("type") != "FeatureCollection":
        report.total_rows = 1
        report.quarantined_rows = 1
        report.quarantine_records.append(
            QuarantinedRecord(
                file_name=file_name,
                row_index=1,
                raw_data={"type": data.get("type")},
                errors=[
                    RowValidationError(
                        column="type",
                        error_code="INVALID_GEOJSON_TYPE",
                        message="GeoJSON root must be a 'FeatureCollection'",
                        invalid_value=data.get("type"),
                    )
                ],
            )
        )
        return valid_features, report

    features = data.get("features", [])
    report.total_rows = len(features)
    min_lon, min_lat, max_lon, max_lat = bbox if bbox else (-180.0, -90.0, 180.0, 90.0)

    for idx, feature in enumerate(features, start=1):
        errors: list[RowValidationError] = []

        geom = feature.get("geometry")
        props = feature.get("properties") or {}

        if not geom or not isinstance(geom, dict):
            errors.append(
                RowValidationError(
                    column="geometry",
                    error_code="MISSING_GEOMETRY",
                    message="Feature is missing geometry object",
                    invalid_value=geom,
                )
            )
        else:
            geom_type = geom.get("type")
            coords = geom.get("coordinates")

            if geom_type == "LineString":
                if not coords or not isinstance(coords, list) or len(coords) < 2:
                    errors.append(
                        RowValidationError(
                            column="coordinates",
                            error_code="INVALID_LINESTRING",
                            message="LineString must contain at least 2 coordinate pairs",
                            invalid_value=coords,
                        )
                    )
                else:
                    # Validate all coordinate pairs
                    for c_idx, pt in enumerate(coords):
                        if (
                            not isinstance(pt, list)
                            or len(pt) < 2
                            or not isinstance(pt[0], (int, float))
                            or not isinstance(pt[1], (int, float))
                        ):
                            errors.append(
                                RowValidationError(
                                    column=f"coordinates[{c_idx}]",
                                    error_code="MALFORMED_COORDINATE_PAIR",
                                    message=f"Coordinate pair {pt} is malformed",
                                    invalid_value=pt,
                                )
                            )
                        else:
                            lon, lat = float(pt[0]), float(pt[1])
                            if not (min_lon <= lon <= max_lon and min_lat <= lat <= max_lat):
                                errors.append(
                                    RowValidationError(
                                        column=f"coordinates[{c_idx}]",
                                        error_code="COORDINATES_OUT_OF_BOUNDS",
                                        message=f"Coordinate [{lon}, {lat}] is out of bounds",
                                        invalid_value=[lon, lat],
                                    )
                                )
            elif geom_type == "Point":
                if (
                    not coords
                    or not isinstance(coords, list)
                    or len(coords) < 2
                    or not isinstance(coords[0], (int, float))
                    or not isinstance(coords[1], (int, float))
                ):
                    errors.append(
                        RowValidationError(
                            column="coordinates",
                            error_code="INVALID_POINT",
                            message="Point coordinates must be [lon, lat]",
                            invalid_value=coords,
                        )
                    )
                else:
                    lon, lat = float(coords[0]), float(coords[1])
                    if not (min_lon <= lon <= max_lon and min_lat <= lat <= max_lat):
                        errors.append(
                            RowValidationError(
                                column="coordinates",
                                error_code="COORDINATES_OUT_OF_BOUNDS",
                                message=f"Point [{lon}, {lat}] is out of bounds",
                                invalid_value=[lon, lat],
                            )
                        )
            else:
                errors.append(
                    RowValidationError(
                        column="geometry.type",
                        error_code="UNSUPPORTED_GEOMETRY_TYPE",
                        message=(
                            f"Geometry type '{geom_type}' is not supported. "
                            "Use LineString or Point."
                        ),
                        invalid_value=geom_type,
                    )
                )

        if errors:
            report.quarantined_rows += 1
            report.quarantine_records.append(
                QuarantinedRecord(
                    file_name=file_name,
                    row_index=idx,
                    raw_data=feature,
                    errors=errors,
                )
            )
        else:
            report.valid_rows += 1
            valid_features.append(
                {
                    "feature_id": props.get("id") or feature.get("id") or f"feature_{idx}",
                    "geometry_type": geom.get("type"),
                    "coordinates": geom.get("coordinates"),
                    "properties": props,
                }
            )

    return valid_features, report


def parse_geojson_file(
    file_path: str | Path,
    bbox: list[float] | None = None,
) -> tuple[list[dict[str, Any]], IngestionReport]:
    """Parse GeoJSON from disk."""
    path = Path(file_path)
    with open(path, "rb") as f:
        content = f.read()
    return parse_geojson_features(content, file_name=path.name, bbox=bbox)
