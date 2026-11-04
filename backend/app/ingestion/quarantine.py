"""Quarantine container for invalid rows and parsing errors."""

from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class RowValidationError(BaseModel):
    """Specific column or field validation failure in a row."""

    column: str
    error_code: str
    message: str
    invalid_value: Any = None


class QuarantinedRecord(BaseModel):
    """An unparsed or invalid row retained in quarantine for review."""

    quarantine_id: UUID = Field(default_factory=uuid4)
    file_name: str
    row_index: int
    raw_data: dict[str, Any]
    errors: list[RowValidationError]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class IngestionReport(BaseModel):
    """Summary of data ingestion, valid row count, and quarantined rows."""

    total_rows: int = 0
    valid_rows: int = 0
    quarantined_rows: int = 0
    quarantine_records: list[QuarantinedRecord] = Field(default_factory=list)

    @property
    def has_quarantine(self) -> bool:
        """Return True if any row was quarantined."""
        return self.quarantined_rows > 0
