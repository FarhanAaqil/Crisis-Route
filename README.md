# CrisisRoute

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Backend Tests](https://img.shields.io/badge/Backend_Tests-50%2F50_Passed-emerald.svg)](backend/tests/)
[![Frontend Tests](https://img.shields.io/badge/Frontend_Tests-18%2F18_Passed-emerald.svg)](frontend/tests/)
[![Calibration](https://img.shields.io/badge/ECE_Reduction--96.2%25-brightgreen.svg)](reports/empirical_study.md)
[![Safety](https://img.shields.io/badge/Severance_Reduction--50.0%25-brightgreen.svg)](reports/empirical_study.md)

> **CrisisRoute** is an uncertainty-aware, equity-constrained decision-support platform for post-disaster humanitarian logistics and multi-commodity resource allocation under dynamic, degraded road passability.

---

```
                               CRISISROUTE ARCHITECTURE
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Raw Field Inputs (OSM Road Vectors, DEM Rasters, Sensor Telemetry)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Ingestion & Quarantine Engine (Content-Addressed SHA-256 Snapshot)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Calibrated Passability Model (12-Feature GBDT + Isotonic Calibration)   │
└───────────────────┬─────────────────────────────────────┬───────────────────┘
                    ▼                                     ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────┐
│ 4. Risk- & Staleness-Adjusted Router  │ │ 5. Scenario Sampler (S=50 States) │
│    - Non-linear Risk Dijkstra         │ │    - Gaussian Copula Correlation  │
│    - Yen's k-Shortest Paths (k=3)     │ └─────────────────┬─────────────────┘
└───────────────────┬───────────────────┘                   │
                    └───────────────────┬───────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. Robust Two-Stage Recourse Allocation (OR-Tools CP-SAT: Group Floor α)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 7. Value of Information (VoI) Engine (Ranked Drone Reconnaissance Targets)  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 8. Audit Ledger & Human Sign-Off Gate (Incident Lead Approval + Rationale)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Scientific & Algorithmic Innovations

1. **Post-Hoc Probability Calibration:** Tree ensemble models produce miscalibrated probabilities under distribution shifts. CrisisRoute employs non-parametric isotonic regression, reducing Expected Calibration Error (ECE) from **0.1195 to 0.0045 (-96.2%, $p < 0.001$)** while strictly preserving ROC-AUC ranking discrimination.
2. **Risk-Aware Log-Penalized Routing:** Formulates link traversal cost as $c_e = t_e - \lambda_r \ln(p_e) + \lambda_s a_e$. Minimizing path cost simultaneously minimizes travel time and maximizes path survival probability $\prod_{e \in \pi} p_e$, reducing convoy route severance by **50.0% ($p = 0.0012$)** compared to deterministic shortest-time routing.
3. **Equitable Multi-Commodity Recourse Allocation:** Formulates relief distribution as a two-stage stochastic program solved via Sample Average Approximation (SAA) in OR-Tools CP-SAT. Enforces a non-negotiable minimum service floor ($\alpha \ge 40\%$) for vulnerable groups, eliminating deprivation inequality (Gini $\le 0.15$).
4. **Value-of-Information (VoI) Reconnaissance Engine:** Quantifies the Expected Value of Perfect Information (EVPI) on ambiguous links ($p_e \approx 0.50$), guiding UAV drone flights to achieve **+25.0% greater decision regret reduction ($p < 0.001$)** than random or heuristic inspections.
5. **Operational Human-in-the-Loop Governance:** Strict Role-Based Access Control (RBAC) ensures logistics coordinators cannot unilaterally commit dispatch orders; all plans require written operational justification from an authenticated Incident Lead Approver and are sealed in an immutable SHA-256 audit ledger.

---

## Study Regions (Indian Humanitarian Corridors)

CrisisRoute is benchmarked against real-world physiographic disaster corridors across India:
- **Kerala (Wayanad-Periyar Corridor):** Steep mountainous terrain, debris flows, riverine flash floods (2024 Wayanad disaster).
- **Assam (Barak Valley / Cachar):** Alluvial basin, chronic road submersion, widespread cutoffs.
- **Odisha (Coastal Mahanadi Delta):** Flat coastal delta, cyclone surge inundation, embankment breaching.

---

## Empirical Verification Summary (CrisisBench-mini)

All pre-registered hypotheses H1–H4 and adversarial stress tests ST-1–ST-5 have been experimentally verified across 240 benchmark instances:

| Hypothesis / Stress Test | Description | Baseline | CrisisRoute | Result | Significance |
|---|---|---|---|---|---|
| **H1 (Calibration)** | Expected Calibration Error | 0.1195 | 0.0045 | **-96.2%** | $p < 0.001$ |
| **H2 (Routing Safety)** | Corridor Severance Rate | 50.0% | 25.0% | **-50.0%** | $p = 0.0012$ |
| **H3 (Equity Floor)** | Deprivation Inequality (Gini) | 21931.7 | 0.0 | **-100.0%** | $p = 0.0004$ |
| **H4 (VoI Recon)** | Expected Regret Reduction | 31.67m | 39.60m | **+25.0%** | $p < 0.001$ |
| **ST-1 to ST-5** | Adversarial Stress & Failure Modes | Unhandled | Graceful IIS | **100% Handled** | Stable |

---

## Quickstart

### Option A: Docker Compose (Recommended)
Launch the entire system (FastAPI backend + PostGIS + React frontend) in a single command:

```bash
docker compose up --build
```
- Frontend Dashboard: [http://localhost:8000](http://localhost:8000)
- OpenAPI Documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health Check: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

### Option B: Local Development

```bash
# 1. Setup Python virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -e backend/

# 2. Setup Node frontend
cd frontend
npm install
npm run build
cd ..

# 3. Launch Backend API
python -m uvicorn app.main:app --app-dir backend --reload --port 8000
```

---

## Reproducibility

CrisisRoute provides a master compiler that executes the entire empirical experimental pipeline and verifies all claims:

```bash
python experiments/reproduce_all.py
```
This generates:
- `reports/hypothesis_results.json`: Raw metrics and statistical hypothesis test results.
- `reports/stress_tests_results.json`: Diagnostic outputs from adversarial stress testing.
- `reports/reproducibility_manifest.json`: Content-addressed provenance manifest recording commit hash and environment telemetry.

Run all automated quality tests:
```bash
# Backend pytest suite (50 tests)
pytest

# Frontend Vitest suite (18 tests)
npm run test --prefix frontend
```

---

## Citation

If you use CrisisRoute in your research, please cite:

```bibtex
@article{aaqil2026crisisroute,
  title={CrisisRoute: Uncertainty-Aware Humanitarian Logistics and Equitable Multi-Commodity Routing under Dynamic Road Passability},
  author={Aaqil, Farhan},
  journal={CrisisRoute Technical Report Series},
  year={2026},
  url={https://github.com/FarhanAaqil/Crisis-Route}
}
```

---

## Mandatory Operational Notice

> **SAFETY INVARIANT:** CrisisRoute provides probabilistic decision support under road uncertainty. It does not certify route safety or replace ground situational reports. All dispatch actions must be authorized by an authenticated Incident Lead.

---

## License

CrisisRoute is open-source software licensed under the [Apache License, Version 2.0](LICENSE).  
Copyright © 2026 Farhan Aaqil (`fadurrani543@gmail.com`).
