# CrisisRoute — Product Specification and Operational User Flow

*Human-in-the-Loop Operational Workflows, Role Matrix, and Failure State UX*  
**Author:** Farhan Aaqil (`fadurrani543@gmail.com`)

---

## 1. Operational Personas and Role-Based Access Control (RBAC)

CrisisRoute enforces strict separation of responsibilities to prevent unreviewed or unauthorized dispatch decisions during emergency response.

| Persona / Role | System Responsibilities | Permitted Actions | Mandatory Constraints |
|---|---|---|---|
| **Logistics Coordinator** (`analyst`) | Scenario formulation, parameter tuning, what-if simulations, route alternative analysis. | Create scenarios, trigger routing and allocation solves, run what-if clones, export diagnostic reports. | Cannot approve or certify plans for execution. Must review data freshness and uncertainty banners before submitting for review. |
| **Field Analyst** (`field_analyst`) | Edge accessibility validation, crowdsourced report triaging, road clearance reporting. | Ingest field observations, tag source credibility and observation epoch, update edge passability evidence. | Cannot alter scenario demand, vehicle fleet allocations, or approve plans. |
| **Incident Lead** (`approver`) | High-level operational oversight, risk tolerance sign-off, final plan authorization. | Approve, reject, or request revisions on submitted relief plans; sign off with cryptographic audit logging. | Must provide written justification. Cannot bypass uncertainty disclosures, binding constraint flags, or rejected alternatives. |

---

## 2. End-to-End Operational Lifecycle

```
[1. Snapshot Creation]
   └─ Upload OSM roads, hazard rasters, depot inventory, vehicle fleet, demand points.
   └─ System validates formats; malformed rows are quarantined (never silently dropped).
   └─ Generates immutable content-addressed Snapshot ID (SHA-256).

[2. Passability Scoring & Uncertainty Quantification]
   └─ Calibrated GBDT scores edge passabilities p_e with credible intervals [l_e, u_e].
   └─ Conflicting observations widen intervals; distribution shift triggers conservative bounds.

[3. Route Alternatives]
   └─ Dijkstra/A* computes primary risk-adjusted route (c_e = t_e - lambda_r log p_e + lambda_s a_e).
   └─ Yen's algorithm computes 2 diverse alternatives with Jaccard overlap metrics and survival probabilities.

[4. Robust Allocation Solve]
   └─ CP-SAT solves delivery matrix across S=50 road-state scenarios.
   └─ Enforces vulnerable group service floors and minimizes expected loss + CVaR tail risk.
   └─ If solver times out (30s), returns best feasible incumbent with non-optimal warning.

[5. Value of Information (Reconnaissance Recommendation)]
   └─ Identifies top-10 candidate edges where inspection would most reduce decision regret per unit cost.

[6. Approver Review & Sign-Off]
   └─ Incident Lead reviews plan: checks unmet need, vulnerable group service, and rejected alternatives.
   └─ Incident Lead approves with written operational rationale. Plan is sealed into immutable audit log.
```

---

## 3. Failure State Handling and Safety Invariants

1. **Solver Infeasibility:** If road cutoffs or severe inventory deficits make service floors mathematically infeasible, the system never silently drops constraints. It returns an explicit diagnostic report detailing the minimal infeasible subsystem (IIS) and unmet demand by priority group.
2. **Solver Timeout:** At the 30-second budget cutoff, the solver returns the best feasible incumbent found, prominently badged as `NON_OPTIMAL_INCUMBENT` with the remaining optimality gap.
3. **Stale Evidence Warning:** Any edge whose latest observation exceeds the scenario staleness threshold ($a_e > \tau_{\text{stale}}$) is highlighted with an amber staleness banner and penalized in routing.
4. **Safety Disclaimer:** Every UI view and printed plan displays the mandatory disclaimer:
   > *"CrisisRoute provides probabilistic decision support. It does not certify route safety or replace on-the-ground situational assessment."*
