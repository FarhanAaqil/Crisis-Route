# CrisisRoute production image: React build + FastAPI runtime in one container.
# Layout mirrors the repository so the app finds contracts/, data/ and frontend/dist unchanged.

# --- Stage 1: build the frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python runtime ---
FROM python:3.12-slim AS runtime

# libgomp1 is needed by OR-Tools and scikit-learn
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    CRISISROUTE_ENVIRONMENT=production \
    CRISISROUTE_STATE_DIR=/var/lib/crisisroute \
    CRISISROUTE_CONTRACTS_DIR=/srv/crisisroute/contracts \
    CRISISROUTE_REPORTS_DIR=/srv/crisisroute/reports \
    CRISISROUTE_FRONTEND_DIST=/srv/crisisroute/frontend/dist

WORKDIR /srv/crisisroute

# Dependencies first so code edits do not bust the cache. Versions come from pyproject.toml.
COPY backend/pyproject.toml backend/README.md ./backend/
COPY backend/app ./backend/app
RUN pip install ./backend

COPY contracts ./contracts
COPY reports/model_calibration.json ./reports/model_calibration.json
COPY --from=frontend-builder /build/dist ./frontend/dist

# Non-root service account with a writable state directory
RUN groupadd --system crisisroute \
    && useradd --system --gid crisisroute --home-dir /srv/crisisroute --shell /usr/sbin/nologin crisisroute \
    && mkdir -p /var/lib/crisisroute \
    && chown -R crisisroute:crisisroute /var/lib/crisisroute
USER crisisroute
VOLUME ["/var/lib/crisisroute"]

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
