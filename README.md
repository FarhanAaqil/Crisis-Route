# CrisisRoute

[![CI](https://github.com/FarhanAaqil/Crisis-Route/actions/workflows/lint.yml/badge.svg)](https://github.com/FarhanAaqil/Crisis-Route/actions/workflows/lint.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)

CrisisRoute is a decision-support tool for post-disaster relief logistics. It estimates how likely each road is to be passable, plans which depots and vehicles serve which communities, guarantees a minimum share to protected groups, and tells the team which road to inspect next. A second person must sign every plan off before it can be treated as deployable.

> **Safety notice.** CrisisRoute provides probabilistic decision support under road uncertainty. It does not certify route safety or replace ground situational reports.

## How it works

```
 field reports ──► evidence fusion ──► road graph (passability per edge)
                                           │
              ┌────────────────────────────┼─────────────────────────────┐
              ▼                            ▼                             ▼
     risk-aware routing          scenario sampling (S worlds)     EVPI recon ranking
   (cost = time − λ·ln p)       correlated hazard realisations   which link to inspect
              └──────────────► CP-SAT allocation + recourse ◄───────────┘
                                           │
                       analyst submits ► different person approves
                                           │
                        hash-chained audit ledger + deployable export
```

- **Evidence fusion.** Field reports update each edge's passability in log-odds. They are weighted by source credibility, fade with a 6 hour half-life, are order independent, and contradictory credible reports on the same edge pull the estimate back towards 50%.
- **Risk-aware routing.** Edge cost is `time + λ_r·(−ln p) + λ_s·staleness`, so minimising cost trades travel time against the chance the route survives. Yen's algorithm provides diverse alternatives.
- **Equitable allocation.** OR-Tools CP-SAT assigns commodities and vehicle trips. Protected groups (for example elderly clusters or tribal hamlets) get at least α of every commodity they need (`floor(α · demand)` per commodity). If the constraints cannot be met the API returns a plain-language infeasibility explanation instead of a bad plan.
- **Reconnaissance value.** For each link on a planned route the tool computes the exact expected value of perfect information for the choice "drive the route or take the detour". Convoys only discover a blockage on arrival, so links that are uncertain and far along the route rank highest.
- **Governance.** Draft → submit → sign-off by someone other than the author, with a written rationale. A decision is final, approval is refused if newer field reports or edited inputs exist, and every action lands in a SHA-256 hash-chained audit ledger that can be verified.

## What the results do and do not show

Everything below is produced by `python experiments/reproduce_all.py` on a **synthetic** benchmark (CrisisBench-mini: 12 generated hazard events across Indian corridors) and three seeded corridors (Kerala, Uttarakhand, Assam). It is evidence that the methods behave as designed, not a field validation.

| Check | Baseline | CrisisRoute | Test |
|---|---|---|---|
| H1 Calibration, held-out events | ECE 0.142 (raw GBDT) | ECE 0.059 (isotonic), −58% | paired bootstrap, p ≈ 0.001 |
| H2 Routing, sampled hazard worlds | 44% routes severed | 24% severed, −46% | exact McNemar, p < 1e-100 (designed instance with one fragile fast road) |
| H3 Equity, 30 perturbed instances | Gini 0.60 (greedy) | Gini 0.01 (CP-SAT) | Wilcoxon, p ≈ 1e-9; both meet the per-commodity floor |
| H4 Reconnaissance | 6.4 min saved (random 5) | 20.2 min saved (EVPI top 5) | permutation test, p ≈ 5e-5 |
| Stress tests | n/a | 5 of 5 degrade gracefully with diagnostics | structural |

Honest caveats: the greedy baseline also satisfies the floor on these instances, so the equity gain is in fairness (Gini), not floor compliance. The routing graph for the seeded scenarios is a synthetic hub-and-spoke corridor built from depot and demand coordinates (`graph_source: synthetic_corridor`). The hypothesis harness evaluates simplified variants and is separate from the frozen protocol in `docs/research/preregistration.md`.

## Quick start

### Docker (one container serves the API and the web app)

```bash
cp .env.example .env                       # set CRISISROUTE_JWT_SECRET_KEY (32+ characters)
cp deploy/users.example.json deploy/users.json
python -m app.security.users hash          # run inside backend/ with the venv active; paste hashes into users.json
docker compose up --build
```

Open <http://localhost:8000>. API docs are at `/api/v1/docs`, health at `/api/v1/health`.

### Local development

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e "backend/[dev]"
cd frontend && npm install && cd ..

python -m uvicorn app.main:app --app-dir backend --reload --port 8000   # API
cd frontend && npm run dev                                              # UI on :5173, proxied to :8000
```

In development the API creates four demo operators (`analyst`, `field`, `approver`, `admin`, password `crisisroute-demo`) and a random signing secret per process. Production refuses to start without `CRISISROUTE_JWT_SECRET_KEY` and `CRISISROUTE_USERS_FILE`.

## Roles

| Role | Can do |
|---|---|
| `field_analyst` | file observations, upload networks |
| `analyst` | everything above, plus run the optimizer, edit resources, submit plans |
| `approver` | approve or reject submitted plans, verify the audit ledger |
| `admin` | all of the above (still cannot approve a plan they generated) |

## Configuration

All settings are `CRISISROUTE_*` environment variables (see `backend/app/core/config.py`).

| Variable | Purpose | Default |
|---|---|---|
| `ENVIRONMENT` | `development` or `production` | `development` |
| `JWT_SECRET_KEY` | token signing key, required in production | random per process in development |
| `USERS_FILE` | JSON list of operators with scrypt hashes, required in production | demo operators in development |
| `CORS_ORIGINS` | comma separated allowed origins | localhost dev origins |
| `STATE_DIR` | where scenarios, plans, observations and the audit ledger persist | `artifacts/state` |
| `MAX_UPLOAD_BYTES` | ingest size limit | 10 MB |

State is stored as JSON files, so a single replica per volume is the supported setup; see `deploy/nginx.example.conf` for a load-balanced layout with a shared volume.

## Repository map

| Path | Contents |
|---|---|
| `backend/app` | FastAPI app: `api/` routers, `domain/` models and evidence fusion, `graph/`, `optimization/` (CP-SAT, recourse, EVPI, sampler), `ml/`, `security/`, `persistence/` |
| `frontend/src` | React app: lazy pages, hooks, API client |
| `experiments/` | benchmark generator, hypothesis and stress tests, `reproduce_all.py` |
| `contracts/` | JSON schemas and the generated OpenAPI document |
| `reports/` | generated results, model card, calibration report |
| `deploy/` | example operators file and reverse-proxy config |

## Quality gates

```bash
make lint     # ruff, ruff format, mypy, tsc
make test     # pytest (backend) and vitest (frontend)
npm run lint --prefix frontend
```

CI runs the same checks plus a production build and a Docker build with a smoke test. See `CONTRIBUTING.md`.

## Citation

```bibtex
@article{aaqil2026crisisroute,
  title={CrisisRoute: Uncertainty-Aware Humanitarian Logistics and Equitable Multi-Commodity Routing under Dynamic Road Passability},
  author={Aaqil, Farhan},
  journal={CrisisRoute Technical Report Series},
  year={2026},
  url={https://github.com/FarhanAaqil/Crisis-Route}
}
```

## License

Apache License 2.0, see [LICENSE](LICENSE). Copyright © 2026 Farhan Aaqil.
