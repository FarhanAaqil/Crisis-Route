"""Main FastAPI application entry point for CrisisRoute."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.health import router as health_router
from app.api.resources import router as resources_router
from app.api.scenarios import router as scenarios_router
from app.core.config import settings
from app.security.auth import audit_logging_middleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown lifecycle management."""
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Uncertainty-Aware Decision Support for Humanitarian Relief Routing "
        "and Equitable Allocation"
    ),
    openapi_url=f"{settings.api_prefix}/openapi.json",
    docs_url=f"{settings.api_prefix}/docs",
    redoc_url=f"{settings.api_prefix}/redoc",
    lifespan=lifespan,
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom correlation ID and audit middleware
app.add_middleware(BaseHTTPMiddleware, dispatch=audit_logging_middleware)

# Register routers
app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(scenarios_router, prefix=settings.api_prefix)
app.include_router(resources_router, prefix=settings.api_prefix)


@app.get("/")
def root():
    """Root entry point providing service identity."""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "api_docs": f"{settings.api_prefix}/docs",
        "health": f"{settings.api_prefix}/health",
    }
