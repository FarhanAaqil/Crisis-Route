"""Append-only, hash-chained audit ledger.

Every event stores the SHA-256 of its own canonical content plus the previous event's hash, so
any later edit, deletion or reordering of history is detectable with ``verify()``.
"""

import hashlib
import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from typing import Any
from uuid import uuid4

from app.core.config import settings
from app.domain.audit import AuditEvent

logger = logging.getLogger("crisisroute.audit")

GENESIS_HASH = "0" * 64


def _canonical(event: AuditEvent) -> str:
    payload = event.model_dump(exclude={"event_hash"})
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def compute_event_hash(event: AuditEvent) -> str:
    return hashlib.sha256(_canonical(event).encode("utf-8")).hexdigest()


class AuditLedger:
    """In-memory view of the ledger, mirrored to a JSON-lines file when a path is given."""

    def __init__(self, path: Path | None = None) -> None:
        self._path = path
        self._events: list[AuditEvent] = []
        self._lock = RLock()
        if path is not None and path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    self._events.append(AuditEvent.model_validate_json(line))
            if not self.verify():
                logger.error("Audit ledger %s failed integrity verification", path)

    def append(
        self,
        user_id: str,
        action: str,
        resource_type: str,
        resource_id: str,
        details: dict[str, Any],
    ) -> AuditEvent:
        with self._lock:
            prev = self._events[-1].event_hash if self._events else GENESIS_HASH
            event = AuditEvent(
                event_id=str(uuid4()),
                timestamp=datetime.now(UTC).isoformat(),
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
                prev_hash=prev,
            )
            event.event_hash = compute_event_hash(event)
            self._events.append(event)
            if self._path is not None:
                self._path.parent.mkdir(parents=True, exist_ok=True)
                with self._path.open("a", encoding="utf-8") as handle:
                    handle.write(event.model_dump_json() + "\n")
            return event

    def events(self) -> list[AuditEvent]:
        with self._lock:
            return list(self._events)

    def verify(self) -> bool:
        """Recompute the chain; False means history was altered."""
        prev = GENESIS_HASH
        for event in self._events:
            if event.prev_hash != prev or compute_event_hash(event) != event.event_hash:
                return False
            prev = event.event_hash
        return True


def _ledger_path() -> Path | None:
    return settings.state_dir / "audit.jsonl" if settings.persist_state else None


LEDGER = AuditLedger(_ledger_path())
