# CrisisRoute

*Uncertainty-Aware Decision Support for Humanitarian Relief Routing and Equitable Allocation*

CrisisRoute is a human-in-the-loop decision-support system designed for post-disaster humanitarian logistics when road network states are noisy, incomplete, stale, or contradictory.

```
                              CRISISROUTE ARCHITECTURE
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Raw Field Inputs (OSM Roads, Hazard Rasters, Citizen & Patrol Reports)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Ingestion & Quarantine Engine (Content-Addressed SHA-256 Snapshot)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Calibrated Passability Model (LightGBM + Isotonic Calibration + Credible)│
└───────────────────┬─────────────────────────────────────┬───────────────────┘
                    ▼                                     ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────────┐
│ 4. Risk- & Staleness-Adjusted Router  │ │ 5. Scenario Sampler (S=50 States) │
│    - Deterministic Dijkstra / A*      │ └─────────────────┬─────────────────┘
│    - Yen's k-Shortest Paths (k=3)     │                   │
└───────────────────┬───────────────────┘                   │
                    └───────────────────┬───────────────────┘
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. Robust Equitable Allocation (OR-Tools CP-SAT: Group Floors + CVaR_0.9)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 7. Value of Information (VOI) Engine (Ranked Next Reconnaissance Checks)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 8. Audit Trail & Human Approval Gate (Incident Lead Sign-off + Rationales)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Core Scientific Question

**Does calibration quality, not just ranking accuracy, decide whether a learned road-risk model improves downstream relief decisions?**

Predictive models for road disruption are typically evaluated using classification metrics (ROC-AUC, PR-AUC), whereas humanitarian logistics optimizers assume edge probabilities are perfectly known. CrisisRoute bridges this gap with an open, reproducible protocol linking probability calibration directly to route exposure, unmet demand, and decision regret.

### Signature Experiment: Controlled Miscalibration
Using temperature scaling:
$$p_e^{(T)} = \sigma\left(\frac{\operatorname{logit}(p_e)}{T}\right), \quad T \in \{0.5, 0.67, 1.0, 1.5, 2.0\}$$
Because temperature scaling is strictly monotonic, ranking discrimination (ROC-AUC) remains exactly invariant while Expected Calibration Error (ECE) varies. Measuring downstream regret across $T$ isolates the causal impact of calibration.

---

## Study Regions (Indian Humanitarian Corridors)

- **Primary Benchmark Region:** Kerala Monsoon & Landslide Corridor (Wayanad & Periyar/Ernakulam Basin)
- **Secondary Evaluation Regions:**
  - Assam Flood Basin (Cachar / Silchar)
  - Odisha Coastal Cyclone Corridor (Puri / Mahanadi Delta)

---

## Quick Start

### Prerequisites
- Python 3.12+
- `uv` package manager (`pip install uv`)
- Node.js 20+ and `npm`

### Backend Setup
```bash
# Create virtual environment and install dependencies
uv venv
uv pip install -e "./backend[dev]"

# Run Ruff linter and formatter checks
ruff check backend/
ruff format --check backend/

# Run unit and contract tests
PYTHONPATH=backend pytest backend/tests -v
```

### Frontend Setup
```bash
cd frontend
npm install
npm run typecheck
npm run test
npm run dev
```

---

## Operational Notice
> **Mandatory Disclaimer:** CrisisRoute provides probabilistic decision support under road uncertainty. It does not certify route safety or replace on-the-ground situational assessment. All plans require written sign-off by an authorized Incident Lead Approver.
