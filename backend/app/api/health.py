"""Health and operational diagnostic endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    """System health check payload."""

    status: str
    version: str
    environment: str
    graph_engine: str
    solver_engine: str


@router.get("/health", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Return operational health status."""
    return HealthResponse(
        status="HEALTHY",
        version=settings.app_version,
        environment=settings.environment,
        graph_engine="NetworkX-2.0",
        solver_engine="OR-Tools CP-SAT v9.10",
    )
