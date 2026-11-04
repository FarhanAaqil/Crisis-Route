# ========================================================
# CrisisRoute Multi-Stage Production Dockerfile
# Stage 1: Build React/Vite Frontend
# Stage 2: Hardened Python 3.12 Production Runtime with FastAPI
# ========================================================

# --- Stage 1: Frontend Builder ---
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production Backend Runtime ---
FROM python:3.12-slim AS runtime

# System runtime dependencies (PostgreSQL client, libgomp for OR-Tools/LightGBM, curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create non-privileged service user
RUN groupadd -r crisisroute && useradd -r -g crisisroute -s /bin/false crisisroute

# Install Python dependencies
COPY backend/pyproject.toml ./backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    fastapi>=0.115.0 \
    uvicorn[standard]>=0.32.0 \
    pydantic>=2.9.2 \
    pydantic-settings>=2.5.2 \
    networkx>=3.4.0 \
    numpy>=2.1.0 \
    scipy>=1.14.0 \
    scikit-learn>=1.5.0 \
    lightgbm>=4.5.0 \
    ortools>=9.10.0 \
    python-multipart>=0.0.12

# Copy backend application source
COPY backend/app/ /app/app/
COPY backend/contracts/ /app/contracts/
COPY experiments/ /app/experiments/
COPY data/ /app/data/

# Copy built frontend distribution into static serving directory
COPY --from=frontend-builder /build/dist /app/static

# Set permissions
RUN chown -R crisisroute:crisisroute /app

USER crisisroute

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    HOST=0.0.0.0

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
