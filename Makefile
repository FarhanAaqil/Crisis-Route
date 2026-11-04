# ========================================================
# CrisisRoute Project Makefile
# Humanitarian Logistics & Equitable Multi-Commodity Routing
# ========================================================

PYTHON ?= python
PYTEST ?= pytest
RUFF ?= ruff
MYPY ?= mypy
NPM ?= npm

.PHONY: all setup install lint test bench reproduce run clean docker-build docker-up

all: lint test

setup:
	$(PYTHON) -m venv .venv
	.venv/Scripts/python -m pip install --upgrade pip
	.venv/Scripts/pip install -e backend/
	cd frontend && $(NPM) install

install: setup

lint:
	$(RUFF) check backend experiments
	$(MYPY) --config-file backend/pyproject.toml backend experiments
	cd frontend && $(NPM) run typecheck

test:
	$(PYTEST)
	cd frontend && $(NPM) run test

bench:
	$(PYTHON) -m experiments.bench.manifest

reproduce:
	$(PYTHON) experiments/reproduce_all.py

run:
	$(PYTHON) -m uvicorn app.main:app --app-dir backend --reload --port 8000

docker-build:
	docker build -t crisisroute:latest .

docker-up:
	docker compose up -d

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
