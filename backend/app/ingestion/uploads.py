"""Secure hashed upload registry and payload validator."""

import hashlib
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.core.config import settings

# Enforce a maximum upload size of 25 MB per file
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = {".csv", ".geojson", ".json", ".tif", ".tiff"}


class UploadMetadata(BaseModel):
    """Metadata recorded for every uploaded file in the registry."""

    upload_id: UUID = Field(default_factory=uuid4)
    file_name: str
    sha256_hash: str
    byte_size: int
    content_type: str
    stored_path: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal and shell injection."""
    cleaned = Path(filename).name
    # Strip any characters that are not alphanumeric, dash, underscore, or dot
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", cleaned)
    if not cleaned or cleaned.startswith("."):
        cleaned = f"upload_{uuid4().hex[:8]}.dat"
    return cleaned


class UploadRegistry:
    """In-memory and filesystem registry for raw ingested files."""

    def __init__(self, storage_dir: Path | None = None) -> None:
        self.storage_dir = storage_dir or (settings.data_dir / "uploads")
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self._registry: dict[str, UploadMetadata] = {}

    async def register_upload(self, upload_file: UploadFile) -> UploadMetadata:
        """Read, hash, validate size and extension, and persist uploaded file."""
        original_name = upload_file.filename or "unnamed_upload"
        extension = Path(original_name).suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            allowed_list = sorted(ALLOWED_EXTENSIONS)
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"File extension '{extension}' is not allowed. Supported: {allowed_list}",
            )

        sanitized_name = sanitize_filename(original_name)
        hasher = hashlib.sha256()
        total_bytes = 0
        chunks: list[bytes] = []

        while True:
            chunk = await upload_file.read(1024 * 1024)  # 1MB chunks
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"Upload exceeded maximum permitted size of {MAX_UPLOAD_BYTES} bytes.",
                )
            hasher.update(chunk)
            chunks.append(chunk)

        sha256_hash = hasher.hexdigest()
        target_path = self.storage_dir / f"{sha256_hash}_{sanitized_name}"

        # Write if not already cached
        if not target_path.exists():
            with open(target_path, "wb") as f:
                for c in chunks:
                    f.write(c)

        meta = UploadMetadata(
            file_name=sanitized_name,
            sha256_hash=sha256_hash,
            byte_size=total_bytes,
            content_type=upload_file.content_type or "application/octet-stream",
            stored_path=str(target_path),
        )
        self._registry[sha256_hash] = meta
        return meta

    def get_upload_by_hash(self, sha256_hash: str) -> UploadMetadata | None:
        """Look up upload record by content SHA-256 hash."""
        return self._registry.get(sha256_hash)


upload_registry = UploadRegistry()
