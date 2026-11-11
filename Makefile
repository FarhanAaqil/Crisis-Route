# CrisisRoute developer shortcuts.
# Works on Linux, macOS and Windows (Git Bash). Override PYTHON to use a specific interpreter.

ifeq ($(OS),Windows_NT)
VENV_BIN := .venv/Scripts
else
VENV_BIN := .venv/bin
endif

PYTHON ?= python
VPY := $(VENV_BIN)/python
NPM ?= npm

.PHONY: all setup lint format test bench reproduce run clean docker-build docker-up

all: lint test

setup:
	$(PYTHON) -m venv .venv
	$(VPY) -m pip install --upgrade pip
	$(VPY) -m pip install -e "backend/[dev]"
	cd frontend && $(NPM) install

lint:
	$(VPY) -m ruff check backend experiments
	$(VPY) -m ruff format --check backend experiments
	$(VPY) -m mypy --config-file backend/pyproject.toml backend/app experiments
	cd frontend && $(NPM) run typecheck

format:
	$(VPY) -m ruff format backend experiments
	$(VPY) -m ruff check --fix backend experiments

test:
	$(VPY) -m pytest
	cd frontend && $(NPM) run test

bench:
	$(VPY) -m experiments.bench.manifest

reproduce:
	$(VPY) experiments/reproduce_all.py

run:
	$(VPY) -m uvicorn app.main:app --app-dir backend --reload --port 8000

docker-build:
	docker build -t crisisroute:latest .

docker-up:
	docker compose up -d --build

clean:
	$(PYTHON) -c "import pathlib, shutil; [shutil.rmtree(p, ignore_errors=True) for n in ('__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache') for p in pathlib.Path('.').rglob(n) if '.venv' not in p.parts and 'node_modules' not in p.parts]"
