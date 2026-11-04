"""Versioned machine learning model registry."""

from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel, Field

from app.core.config import settings
from app.ml.calibrated_model import CalibratedPassabilityModel


class ModelMetadata(BaseModel):
    """Metadata recorded for registered passability models."""

    model_version: str
    model_type: str
    trained_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    metrics: dict[str, float] = Field(default_factory=dict)
    feature_count: int
    training_samples: int
    is_active: bool = True


class ModelRegistry:
    """Registry managing active and versioned passability estimators."""

    def __init__(self, registry_dir: Path | None = None) -> None:
        self.registry_dir = (registry_dir or settings.artifacts_dir) / "models"
        self.registry_dir.mkdir(parents=True, exist_ok=True)
        self._active_model: CalibratedPassabilityModel | None = None
        self._metadata_cache: dict[str, ModelMetadata] = {}

    def register_model(
        self,
        model: CalibratedPassabilityModel,
        metrics: dict[str, float],
        training_samples: int,
        feature_count: int = 12,
    ) -> ModelMetadata:
        """Register a trained model instance and persist its metadata."""
        meta = ModelMetadata(
            model_version=model.model_version,
            model_type="GBDT_Isotonic",
            metrics=metrics,
            feature_count=feature_count,
            training_samples=training_samples,
            is_active=True,
        )

        self._active_model = model
        self._metadata_cache[model.model_version] = meta

        # Persist descriptor
        meta_file = self.registry_dir / f"{model.model_version}_meta.json"
        with open(meta_file, "w", encoding="utf-8") as f:
            f.write(meta.model_dump_json(indent=2))

        return meta

    def get_active_model(self) -> CalibratedPassabilityModel:
        """Retrieve current active model with fallback to newly initialized default."""
        if self._active_model is None:
            self._active_model = CalibratedPassabilityModel()
        return self._active_model

    def list_models(self) -> list[ModelMetadata]:
        """List all recorded model versions."""
        return list(self._metadata_cache.values())


model_registry = ModelRegistry()
