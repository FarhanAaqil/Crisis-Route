# Architecture Decision Record (ADR) 001: Project Scope, Boundaries, and Operational Invariants

**Status:** Accepted  
**Date:** 2026-11-04  
**Author:** Farhan Aaqil (`fadurrani543@gmail.com`)  
**Context:** CrisisRoute Decision Support System

---

## 1. Context and Problem Statement
Post-disaster humanitarian logistics operations frequently suffer from incomplete, contradictory, and rapidly decaying information regarding road network accessibility. Existing tools either treat accessibility as binary and static or rely on raw classification scores without evaluating probability calibration. 

The primary research objective is to test whether probability calibration—evaluated independently from ranking discrimination (ROC-AUC)—directly determines downstream relief route exposure, group equity, and decision regret.

## 2. Decision
We freeze the scope of the CrisisRoute system as an auditable, human-in-the-loop decision-support tool operating on a bounded regional road network with the following core architectural invariants:

1. **Human-in-the-Loop Sign-Off:** The system serves exclusively as a decision aid. It never executes automated dispatch, and every relief plan must be reviewed and signed off with written rationale by a designated Incident Lead Approver.
2. **Immutable Content-Addressed Snapshots:** Every planning scenario operates on a sealed, immutable snapshot. Input files (OSM networks, hazard rasters, road observations) are content-hashed (SHA-256). Modifications create a new versioned snapshot; past plans are permanently preserved for auditability.
3. **Calibrated Probabilistic Modeling:** Machine learning components output calibrated passability probabilities $p_e \in [0, 1]$ accompanied by bootstrap-derived credible intervals. Conflicting observations widen intervals rather than averaging away uncertainty.
4. **Deterministic and Robust Optimization:** 
   - Routing uses deterministic shortest path (Dijkstra/A*) on risk- and staleness-penalized edge weights, generating $k=3$ diverse alternatives via Yen's algorithm.
   - Resource allocation uses OR-Tools CP-SAT over $S=50$ sampled road states, optimizing a weighted combination of expected deprivation loss and Conditional Value-at-Risk ($\text{CVaR}_{0.9}$), constrained by minimum vulnerable group service floors.
5. **No Silent Failures:** Solver timeouts return the best feasible incumbent flagged as non-optimal. Infeasible scenarios compute and return binding constraint diagnostics.
6. **Hardware & Operational Envelope:** All modules execute within a CPU-only envelope (4 cores, 16 GB RAM) suitable for local field deployment without requiring cloud GPUs, distributed message brokers, or external proprietary APIs.

## 3. Explicit Non-Goals (Out of Scope)
The following capabilities are strictly excluded from the MVP scope:
- Live vehicular navigation and turn-by-turn guidance.
- Autonomous fleet or drone dispatch.
- Predictive forecasting of natural hazard inception (earthquake/cyclone triggering).
- Medical triage or individual casualty prioritization.
- Ingestion of uncurated, unauthenticated public social media streams.
- Safety certification of public infrastructure.

## 4. Consequences
- **Positive:** Enables fully reproducible experiments, deterministic audit trails, low operational overhead, and verifiable research hypotheses.
- **Negative:** Requires pre-processing of regional road network extracts and synthetic/semi-synthetic hazard overlays before planning execution.
