"""A small dict-like store that keeps pydantic models in memory and mirrors them to disk."""

import json
import logging
import os
import tempfile
from collections.abc import Iterator, MutableMapping
from pathlib import Path
from threading import RLock

from pydantic import BaseModel

logger = logging.getLogger("crisisroute.persistence")


def atomic_write_text(path: Path, text: str) -> None:
    """Write via a temp file and rename so a crash never leaves a half-written record."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=path.name, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise


class ModelStore[T: BaseModel](MutableMapping[str, T]):
    """Mapping of id -> pydantic model. Each record is one JSON file when a directory is set.

    Models are mutated in place by the API layer, so call ``save(key)`` after changing one.
    """

    def __init__(self, model_cls: type[T], directory: Path | None) -> None:
        self._model_cls = model_cls
        self._dir = directory
        self._items: dict[str, T] = {}
        self._lock = RLock()
        if directory is not None:
            self._load()

    def _path(self, key: str) -> Path | None:
        return None if self._dir is None else self._dir / f"{key}.json"

    def _load(self) -> None:
        assert self._dir is not None
        if not self._dir.exists():
            return
        for file in sorted(self._dir.glob("*.json")):
            try:
                self._items[file.stem] = self._model_cls.model_validate_json(
                    file.read_text(encoding="utf-8")
                )
            except (ValueError, OSError):
                logger.exception("Skipping unreadable record %s", file)

    def save(self, key: str) -> None:
        path = self._path(key)
        if path is not None and key in self._items:
            atomic_write_text(path, self._items[key].model_dump_json(indent=2))

    def __getitem__(self, key: str) -> T:
        return self._items[key]

    def __setitem__(self, key: str, value: T) -> None:
        with self._lock:
            self._items[key] = value
            self.save(key)

    def __delitem__(self, key: str) -> None:
        with self._lock:
            del self._items[key]
            path = self._path(key)
            if path is not None:
                path.unlink(missing_ok=True)

    def __iter__(self) -> Iterator[str]:
        return iter(list(self._items))

    def __len__(self) -> int:
        return len(self._items)


class ListStore[T: BaseModel]:
    """id -> ordered list of models (used for per-scenario observations)."""

    def __init__(self, model_cls: type[T], directory: Path | None) -> None:
        self._model_cls = model_cls
        self._dir = directory
        self._items: dict[str, list[T]] = {}
        self._versions: dict[str, int] = {}
        self._lock = RLock()
        if directory is not None and directory.exists():
            for file in sorted(directory.glob("*.json")):
                try:
                    raw = json.loads(file.read_text(encoding="utf-8"))
                    self._items[file.stem] = [model_cls.model_validate(r) for r in raw]
                    self._versions[file.stem] = len(self._items[file.stem])
                except (ValueError, OSError):
                    logger.exception("Skipping unreadable record %s", file)

    def get(self, key: str, default: list[T] | None = None) -> list[T]:
        return list(self._items.get(key, default or []))

    def version(self, key: str) -> int:
        """Counter that only ever grows, so cache keys never collide after edits."""
        return self._versions.get(key, 0)

    def append(self, key: str, item: T) -> None:
        with self._lock:
            self._items.setdefault(key, []).append(item)
            self._versions[key] = self._versions.get(key, 0) + 1
            if self._dir is not None:
                payload = [i.model_dump(mode="json") for i in self._items[key]]
                atomic_write_text(self._dir / f"{key}.json", json.dumps(payload, indent=2))
