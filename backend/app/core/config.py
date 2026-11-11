"""Application configuration and environmental settings."""

import logging
import secrets
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("crisisroute.config")

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent


class Settings(BaseSettings):
    """CrisisRoute application runtime settings (all overridable as CRISISROUTE_* env vars)."""

    model_config = SettingsConfigDict(
        env_prefix="CRISISROUTE_",
        env_file=".env",
        extra="ignore",
    )

    app_name: str = "CrisisRoute Decision Support System"
    app_version: str = "0.2.0"
    api_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = False

    # Security
    # In development an unset secret is replaced by a random per-process one, so tokens never
    # rely on a value committed to the repository. Production refuses to start without one.
    jwt_secret_key: str | None = None
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000"
    users_file: Path | None = None
    max_upload_bytes: int = 10 * 1024 * 1024
    login_max_failures: int = 5
    login_lockout_seconds: int = 60

    # Storage paths
    base_dir: Path = _REPO_ROOT / "backend"
    contracts_dir: Path = _REPO_ROOT / "contracts"
    artifacts_dir: Path = _REPO_ROOT / "artifacts"
    data_dir: Path = _REPO_ROOT / "data"
    state_dir: Path = _REPO_ROOT / "artifacts" / "state"
    persist_state: bool = True
    frontend_dist: Path = _REPO_ROOT / "frontend" / "dist"

    # Solver & ML Defaults
    default_random_seed: int = 42
    default_solver_time_limit_sec: int = 30
    default_scenario_samples: int = 50

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _resolve_secret(self) -> "Settings":
        if not self.jwt_secret_key:
            if self.is_production:
                raise ValueError(
                    "CRISISROUTE_JWT_SECRET_KEY must be set when CRISISROUTE_ENVIRONMENT=production"
                )
            self.jwt_secret_key = secrets.token_urlsafe(48)
            logger.warning(
                "No CRISISROUTE_JWT_SECRET_KEY set; using a random secret for this process. "
                "Issued tokens will stop working on restart."
            )
        elif self.is_production and len(self.jwt_secret_key) < 32:
            raise ValueError("CRISISROUTE_JWT_SECRET_KEY must be at least 32 characters")
        return self


settings = Settings()
