"""Data ingestion endpoints for CSV and GeoJSON road networks with quarantine buffer."""

import hashlib
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.domain.models import UserRole
from app.ingestion.csv_parser import parse_road_edges_csv
from app.ingestion.geojson_parser import parse_geojson_features
from app.ingestion.quarantine import IngestionReport, QuarantinedRecord, RowValidationError
from app.security.auth import CurrentUser, record_audit_event, require_role

router = APIRouter(prefix="/ingest", tags=["Ingestion"])


class IngestUploadResponse(BaseModel):
    """Result of file ingestion, schema validation, and quarantine buffering."""

    file_name: str
    snapshot_hash: str
    total_rows: int
    valid_rows: int
    quarantined_rows: int
    quarantine_records: list[QuarantinedRecord]
    valid_edges_preview: list[dict[str, Any]] = Field(default_factory=list)


@router.post("/upload", response_model=IngestUploadResponse)
async def upload_network_data(
    file: UploadFile | None = File(default=None),
    raw_content: str | None = Form(default=None),
    file_name: str | None = Form(default=None),
    current_user: CurrentUser = Depends(
        require_role([UserRole.ANALYST, UserRole.FIELD_ANALYST, UserRole.ADMIN])
    ),
) -> IngestUploadResponse:
    """Ingest, validate, and hash road network data without silent data dropping.

    Accepts multipart file upload or form-encoded text (CSV / GeoJSON).
    """
    if file is not None:
        filename = file.filename or "uploaded_network.csv"
        limit = settings.max_upload_bytes
        content_bytes = await file.read(limit + 1)
        if len(content_bytes) > limit:
            raise HTTPException(
                status_code=413,
                detail=f"Upload exceeds the {limit // (1024 * 1024)} MB limit",
            )
        try:
            content = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content = content_bytes.decode("latin-1")
    elif raw_content is not None:
        filename = file_name or "payload.csv"
        content = raw_content
        if len(content.encode("utf-8")) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Payload exceeds the {settings.max_upload_bytes // (1024 * 1024)} MB limit",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'file' or 'raw_content' must be provided",
        )

    # Compute SHA-256 snapshot hash of raw upload
    snapshot_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

    lower_name = filename.lower()
    valid_edges: list[dict[str, Any]] = []
    report = IngestionReport()

    if lower_name.endswith(".geojson") or lower_name.endswith(".json"):
        try:
            valid_edges, report = parse_geojson_features(file_content=content, file_name=filename)
        except (ValueError, KeyError, TypeError) as exc:
            # Entire file malformed -> quarantine whole payload
            report.total_rows = 1
            report.quarantined_rows = 1
            report.quarantine_records.append(
                QuarantinedRecord(
                    file_name=filename,
                    row_index=0,
                    raw_data={"raw_preview": content[:200]},
                    errors=[
                        RowValidationError(
                            column="file",
                            error_code="JSON_PARSE_ERROR",
                            message=f"Malformed GeoJSON: {exc}",
                        )
                    ],
                )
            )
    else:
        # Assume CSV format
        valid_edges, report = parse_road_edges_csv(file_content=content, file_name=filename)

    # Return top 15 edges for spatial preview in UI
    preview = []
    for e in valid_edges[:15]:
        preview.append(
            {
                "edge_id": str(e.get("edge_id")),
                "road_class": str(e.get("road_class", "primary")),
                "length_m": float(e.get("length_m", 1000.0)),
                "free_flow_sec": float(e.get("free_flow_sec", 120.0)),
                "passability_prob": float(e.get("passability_prob", 0.90)),
                "bridge": bool(e.get("bridge", False)),
            }
        )

    record_audit_event(
        user_id=current_user.user_id,
        action="INGEST_UPLOAD",
        resource_type="network_snapshot",
        resource_id=snapshot_hash,
        details={
            "file_name": filename,
            "total_rows": report.total_rows,
            "valid_rows": report.valid_rows,
            "quarantined_rows": report.quarantined_rows,
        },
    )

    return IngestUploadResponse(
        file_name=filename,
        snapshot_hash=snapshot_hash,
        total_rows=report.total_rows,
        valid_rows=report.valid_rows,
        quarantined_rows=report.quarantined_rows,
        quarantine_records=report.quarantine_records,
        valid_edges_preview=preview,
    )
