"""Application configuration and environmental settings."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """CrisisRoute application runtime settings."""

    model_config = SettingsConfigDict(
        env_prefix="CRISISROUTE_",
        env_file=".env",
        extra="ignore",
    )

    app_name: str = "CrisisRoute Decision Support System"
    app_version: str = "0.1.0"
    api_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = False

    # Security
    jwt_secret_key: str = "crisisroute-dev-insecure-secret-key-change-in-production-2026"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480

    # Storage paths
    base_dir: Path = Path(__file__).resolve().parent.parent.parent
    contracts_dir: Path = base_dir.parent / "contracts"
    artifacts_dir: Path = base_dir.parent / "artifacts"
    data_dir: Path = base_dir.parent / "data"

    # Solver & ML Defaults
    default_random_seed: int = 42
    default_solver_time_limit_sec: int = 30
    default_scenario_samples: int = 50


settings = Settings()
