"""Main FastAPI application entry point for CrisisRoute."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

from app.api.allocation import router as allocation_router
from app.api.audit import router as audit_router
from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.ingest import router as ingest_router
from app.api.intelligence import router as intelligence_router
from app.api.passability import router as passability_router
from app.api.resources import router as resources_router
from app.api.scenarios import router as scenarios_router
from app.core.config import settings
from app.security.auth import audit_logging_middleware, get_current_user


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

# Compress JSON and static payloads (big passability and plan responses shrink ~5-10x)
app.add_middleware(GZipMiddleware, minimum_size=1024)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Correlation-Id"],
    expose_headers=["X-Correlation-Id"],
)

# Custom correlation ID and audit middleware
app.add_middleware(BaseHTTPMiddleware, dispatch=audit_logging_middleware)

# Register routers
# Health and sign-in are public; every other router requires a verified bearer token.
app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(auth_router, prefix=settings.api_prefix)
_protected = [Depends(get_current_user)]
for _router in (
    scenarios_router,
    resources_router,
    allocation_router,
    audit_router,
    passability_router,
    intelligence_router,
    ingest_router,
):
    app.include_router(_router, prefix=settings.api_prefix, dependencies=_protected)


class SPAStaticFiles(StaticFiles):
    """Serve the built React app: long-lived caching for hashed assets, SPA fallback for routes."""

    async def get_response(self, path: str, scope: Scope):  # type: ignore[no-untyped-def]
        path = path.replace("\\", "/")  # Starlette joins with os.sep on Windows
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or path.startswith(("assets/", "api/")):
                raise
            response = await super().get_response("index.html", scope)
        if path.startswith("assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response


_dist = settings.frontend_dist
if (_dist / "index.html").exists():
    # Mounted last so every /api/v1 route above keeps priority
    app.mount("/", SPAStaticFiles(directory=str(_dist), html=True), name="ui")
else:

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        """Service identity when no built frontend is present."""
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "api_docs": f"{settings.api_prefix}/docs",
        }
