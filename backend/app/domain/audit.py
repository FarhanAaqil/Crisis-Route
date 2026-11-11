"""Audit record schema shared by the security layer, the ledger and the API."""

from typing import Any

from pydantic import BaseModel


class AuditEvent(BaseModel):
    """Immutable audit record for critical operational actions."""

    event_id: str
    timestamp: str
    user_id: str
    action: str
    resource_type: str
    resource_id: str
    details: dict[str, Any]
    prev_hash: str = ""
    event_hash: str = ""
