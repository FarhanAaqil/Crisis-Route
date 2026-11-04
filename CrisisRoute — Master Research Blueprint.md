# CrisisRoute — Master Research Blueprint

*Uncertainty-Aware Decision Support for Humanitarian Relief Routing and Equitable Allocation*

Nov 2, 2026 · @Farhan Aaqil

## 1. Executive Summary

CrisisRoute is a human-in-the-loop decision-support system that plans relief routes and supply allocations after a disaster when road conditions are uncertain, stale or contradictory. It combines a calibrated road-passability model, deterministic risk-aware routing, robust equitable allocation with OR-Tools CP-SAT, and a ranked "what to check next" recommendation. A human approver signs off every plan. The system never certifies a route as safe.

The research bet is narrow and testable: **does calibration quality, not just ranking accuracy, decide whether a learned road-risk model improves downstream relief decisions?** Predictive work on road disruption usually stops at classification metrics, and humanitarian optimisation models usually take edge probabilities as given. CrisisRoute closes the loop with one reproducible protocol that traces a probability error all the way to route exposure, under-served demand and decision regret.

The signature experiment is **controlled miscalibration**: temperature-distort the model's probabilities so ranking (ROC-AUC) is unchanged while calibration error rises, then measure how regret moves. If regret rises with calibration error at fixed AUC, calibration is shown to be decision-critical; if it does not, that is a clean negative result.

This blueprint upgrades the original 56-day, 31-file plan into one document. It keeps the locked scope (one region, CPU-only, two people, 56 working days), restructures delivery into **eight gated phases**, and addresses the two largest credibility risks up front: sparse real labels (handled with a semi-synthetic benchmark whose ground truth is known, so regret is computable) and small test sets (handled with event-grouped splits, paired bootstrap intervals and an explicit statistical-power note in Section 9).

## 2. Literature Landscape

CrisisRoute sits where three literatures meet but rarely test each other: probability calibration, predict-then-optimise, and humanitarian logistics under uncertainty. The contribution is the protocol that connects them, not any single component.

### 2.1 Foundational techniques used in this project

Each CrisisRoute module is a direct implementation of an established method. Naming them makes clear the novelty is the evaluation loop in Sections 3–8, not the parts.

| Technique (paper) | What it does | Module it grounds |
| --- | --- | --- |
| Isotonic / Platt calibration of boosted trees ([Niculescu-Mizil & Caruana, ICML 2005](https://mlanthology.org/icml/2005/niculescumizil2005icml-predicting)) | Shows boosted trees rank well but produce distorted probabilities; post-hoc calibration fixes them | Passability model: gradient-boosted trees + isotonic calibration |
| Temperature scaling, ECE ([Guo et al., ICML 2017](https://proceedings.mlr.press/v70/guo17a)) | Single-parameter rescaling of logits; reliability diagrams and expected calibration error | Calibration metrics and the controlled-miscalibration experiment |
| k-shortest loopless paths (Yen, Management Science 1971) | Enumerates ranked alternative paths | Three diverse route alternatives |
| Robust emergency logistics ([Ben-Tal et al., Transportation Research B 2011](https://econpapers.repec.org/RePEc:eee:transb:v:45:y:2011:i:8:p:1177-1189)) | Robust optimisation for relief supply chains under demand uncertainty | Robust allocation objective |
| Conditional value-at-risk (Rockafellar & Uryasev, Journal of Risk 2000) | Linear-programming form of tail risk | Expected-plus-tail loss in the robust allocator |
| Information value theory (Howard, IEEE Trans. SSC 1966) | Prices an observation by how much it is expected to improve a decision | Ranked "what to check next" action |

### 2.2 Closely related work

Each row states what the work contributes and what it leaves open; the gap in Section 3 is triangulated from the right-hand column.

| Work (year) | Core contribution | What it leaves open |
| --- | --- | --- |
| [Smart Predict-then-Optimize (Elmachtoub & Grigas, Management Science 2022)](https://econpapers.repec.org/RePEc:inm:ormnsc:v:68:y:2022:i:1:p:9-26) | Trains predictors on decision loss (SPO+) rather than prediction error | Assumes point predictions of costs; does not study probability calibration or humanitarian equity constraints |
| [Decision-Focused Learning survey and benchmark (Mandi et al., JAIR 2024)](https://mlanthology.org/jair/2024/mandi2024jair-decisionfocused) | Unifies DFL methods; benchmarks them on shortest path, knapsack and scheduling | Benchmarks are synthetic and deterministic-cost; no stale or conflicting evidence, no human approval step |
| [Calibrating Predictions to Decisions (Zhao et al., NeurIPS 2021)](https://proceedings.neurips.cc/paper/2021/hash/bbc92a647199b832ec90d7cf57074e9e-Abstract.html) | Defines decision calibration: probabilities only need to be calibrated for the decisions they feed | Theory and classification-style decisions; not tested on a routing-plus-allocation pipeline |
| [Canadian Traveller Problem (Papadimitriou & Yannakakis, ICALP 1989)](https://en.wikipedia.org/wiki/Canadian_traveller_problem) | Shortest paths when some edges may be blocked and are revealed only on arrival | Edge-blocking probabilities are given, never learned or checked for calibration |
| [Deprivation-cost objectives (Holguín-Veras et al., J. Operations Management 2013)](https://itspubs.ucdavis.edu/publication_detail.php?id=2372) | Argues relief models should minimise human suffering (deprivation), not only logistics cost | Deterministic network; no learned road risk |
| [Equity and deprivation costs (Gutjahr & Fischer, EJOR 2018)](https://econpapers.repec.org/RePEc:eee:ejores:v:270:y:2018:i:1:p:185-197) | Adds an inequity term to deprivation-cost relief distribution | Road state assumed known; no information-gathering decision |
| [Repair-crew routing for relief distribution (Duque et al., EJOR 2016)](https://econpapers.repec.org/RePEc:eee:ejores:v:248:y:2016:i:1:p:272-285) | Jointly schedules road repair and relief access on damaged networks | Damage state deterministic; no probabilistic evidence |
| [Flood risk for route choice (Bucar & Hayeri, RESS 2022)](https://ideas.repec.org/a/eee/reensy/v219y2022ics0951832021006803.html) | Link-level flood risk from drainage and geospatial data; RL routing that avoids flood-prone links | Single-vehicle route choice; no allocation, equity or calibration analysis |
| [AILAS, HeiGIT (Madagascar pilot, ongoing)](https://heigit.org/AILAS/) | CNN passability from street imagery, extended with rainfall and soil data; penalises roads in openrouteservice | Graded scores rather than calibrated probabilities; no allocation optimiser or value-of-information ranking |

## 3. The Research Gap

Stated as narrowly as possible, so it is buildable and falsifiable in 56 working days:

> **Identified gap.** Humanitarian routing and allocation models take road-blocking probabilities as given, while road-passability predictors are judged on classification metrics alone. To our reading of the work in Section 2, no open, reproducible protocol measures how the *calibration* of a learned passability model — separately from its ranking accuracy — propagates into route exposure, equitable allocation and the value of the next field check, under stale and conflicting evidence, with a human approval step.

Why this gap matters and is worth closing:

- **It turns a theory into a field test.** Decision calibration (Zhao et al. 2021) argues probabilities need only be calibrated for the decisions they feed. CrisisRoute tests that claim on a real road graph with coupled routing, allocation and equity constraints.
- **It is cleanly falsifiable.** Temperature distortion changes calibration while leaving ROC-AUC exactly unchanged, so any change in regret is attributable to calibration alone. Either regret tracks calibration error or it does not.
- **It is buildable by two people on CPU.** One region, one tabular model, one CP-SAT allocator, NetworkX routing — the scope locked in the original plan.
- **It has a safety payoff either way.** If calibration matters, deployed relief tools must report it; if it does not, teams can stop spending effort on it and focus on ranking quality.

The claim is deliberately hedged ("to our reading"). Phase 1 includes a two-day literature re-check; if a prior paper already reports this exact protocol, the contribution narrows to the open benchmark and harness, and the blueprint says so.

## 4. Research Questions and Hypotheses

Four questions, each with a pre-registered hypothesis and a numeric threshold fixed in Phase 1 before any test-split result is seen.

**RQ1 — Prediction.** Can a calibrated gradient-boosted model estimate road-edge passability better than a road-class frequency baseline on an event-grouped holdout?

**RQ2 — Calibration to decisions (core).** Holding ranking accuracy fixed, does calibration error change downstream route exposure and decision regret?

**RQ3 — Equitable allocation.** Does a robust, equity-constrained allocator improve service to the worst-served group without a large loss in total service?

**RQ4 — Information value.** Does ranking field checks by expected decision value reduce regret faster per unit cost than random or highest-uncertainty selection?

| ID | Hypothesis | Pass threshold |
| --- | --- | --- |
| H1 | Calibrated boosted trees beat the frequency baseline on Brier score | Brier lower, paired-bootstrap 95% CI excludes zero |
| H2 (primary) | At fixed ROC-AUC, regret rises monotonically as expected calibration error (ECE) rises | Spearman ρ between ECE and mean regret ≥ 0.8 across the temperature sweep, CI excludes zero |
| H3 | Risk-aware routing with calibrated probabilities reduces blocked-edge exposure versus shortest-time | ≥ 25% exposure reduction at ≤ 20% median ETA inflation |
| H4 | Robust equitable allocation raises worst-group service versus proportional greedy | Worst-group served fraction higher, ≤ 5% reduction in total served demand |
| H5 | Value-ranked checks beat random and highest-uncertainty selection | Higher cumulative regret reduction per unit cost after 5 checks, CI excludes zero |

The 20% ETA and 5% total-service limits come from the original research evaluation plan. The 25% exposure target and the ρ ≥ 0.8 bar are new and are frozen in Phase 1. A failed hypothesis is reported as a result, not removed.

## 5. Proposed System: CrisisRoute

CrisisRoute turns fragmented post-disaster evidence into a reviewable plan: which roads to use, what to send where, how sure the system is, and which single field check would most change the plan. It supports a decision; it never makes one.

### 5.1 Users and decision boundary

| Role | What they do | What they can never skip |
| --- | --- | --- |
| Logistics coordinator (Analyst) | Creates scenarios, imports data, runs plans and what-ifs | Data-age and uncertainty banners on every plan |
| Field analyst | Adds and validates closures and observations | Source, time and confidence on every observation |
| Incident lead (Approver) | Approves, rejects or revises an immutable plan | A written rationale; rejected alternatives shown |

### 5.2 Core idea

1. **Snapshot.** Import a bounded region's roads, facilities, demand, inventory, vehicles and observations into an immutable, hashed snapshot. Invalid rows are quarantined, never silently dropped.
2. **Graph.** Build a versioned directed road graph; every edge carries travel time, source, observation time, status and confidence.
3. **Passability.** A calibrated model gives each edge a probability of being passable plus an interval. Conflicting evidence widens the interval; distribution shift falls back to conservative rules.
4. **Routes.** Deterministic Dijkstra/A\* over a risk- and staleness-adjusted cost produces up to three diverse alternatives, each with its survival probability.
5. **Allocation.** CP-SAT assigns commodities to demand points across sampled road-state scenarios, with hard capacity and inventory limits, minimum-service floors per group and explicit unmet-demand slack.
6. **Explanation.** Every plan shows binding constraints, evidence age, uncertainty, rejected alternatives and unmet need by reason.
7. **Next check.** For the top ten uncertain edges on or near the chosen routes, the system simulates "open" and "blocked" outcomes and ranks checks by expected regret reduction per unit cost.
8. **Approval.** A human approves, rejects or revises. A new observation creates a new graph version; the old plan stays visible with a "decision changed / unchanged" flag.

## 6. Novelty and Contribution Claims

### 6.1 How this differs from the closest prior work

> **vs. Decision-focused learning (Elmachtoub & Grigas 2022; Mandi et al. 2024).** DFL changes *how the model is trained* so its predictions suit a downstream optimiser. CrisisRoute keeps a standard, auditable predict-then-optimise pipeline and asks a prior question: *how much does probability calibration alone move decision quality?* This is an evaluation contribution, and an SPO-style training arm is listed as a Could-have, not a promise.

> **vs. Decision calibration (Zhao et al. 2021).** That work defines when calibration matters for decisions, in theory and on classification tasks. CrisisRoute measures it on a coupled routing-plus-allocation problem with equity floors, stale evidence and a value-of-information step — a setting the theory has not been tested in.

> **vs. Operational passability tools (AILAS).** AILAS predicts graded passability and penalises roads in a router. CrisisRoute adds calibrated probabilities with intervals, a robust equitable allocator, a ranked next-check and a mandatory approval trail — and it is an open research harness, not a field service.

| Claim | Why it is new |
| --- | --- |
| Controlled-miscalibration protocol | Temperature distortion holds ROC-AUC fixed while varying ECE, isolating calibration's causal effect on route exposure and regret |
| End-to-end regret accounting | Semi-synthetic ground truth makes true regret computable for routing, allocation and information actions in one pipeline |
| Calibration-aware value of information | Next-check ranking uses the calibrated probabilities directly, so miscalibration's cost to information gathering is measured too |
| Equity under uncertain access | Worst-group service floors are optimised across sampled road states, not on one assumed network |
| Reproducible open benchmark | Snapshot hashes, run manifests and a regenerable result table for every claim |

What CrisisRoute does **not** claim: new routing algorithms, a new calibration method, a new solver, or any measure of lives saved.

## 7. System Architecture

CrisisRoute is a modular monolith: one FastAPI application, PostgreSQL with PostGIS, a Redis job queue with workers, and immutable content-addressed artifact storage. Learning is confined to one stage so the rest of the pipeline can be tested deterministically.

&#91;embedded content: CrisisRoute decision pipeline · 8 stages and the information loop\]

Evidence moves top to bottom to a human decision; the next-check loop never mutates a past plan, it creates a new graph version beside it.

### 7.1 Runtime components

| Component | Role | Runs as |
| --- | --- | --- |
| React client | Map, scenarios, plans, explanation, approval, system health | Static frontend |
| FastAPI app | HTTP contracts under `/api/v1`, auth, validation, CRUD and reads | Synchronous |
| Redis + RQ worker | Imports, graph builds, batch scoring, optimisation, evaluation | Background jobs, idempotent by type + input hash + config hash |
| PostgreSQL + PostGIS | 20 tables: scenarios, snapshots, road edges, observations, versions, runs, decisions, audit events | GiST indexes on region, points and lines |
| Artifact storage | Raw uploads, snapshots, graphs, models, experiment outputs | Immutable, content-addressed |

### 7.2 Runtime rules

- Long operations return HTTP 202 with a job resource; errors use `{code, message, details, correlation_id}`.
- Snapshots, graph versions and model versions are never edited; a scenario pins exactly one snapshot and configuration.
- A solver timeout returns the best feasible incumbent marked non-optimal; infeasibility returns diagnostics. No silent fallback is permitted.
- Identical snapshot, configuration, seed, model and code revision must reproduce equivalent outputs.
- Executable DDL lives in `30_CrisisRoute_Schema.sql`; the API surface is the 16 endpoints in the original API specification.

## 8. Technical Formulation

Five pieces of maths carry the system; each is small enough to implement and test in one phase.

### 8.1 Passability model

For each directed edge e at decision time t, the model outputs p\_e = P(edge passable at t | evidence). Features: road class, surface, slope proxy, hazard-footprint overlap, observation type and age, source reliability, nearby closure density, bridge flag, plus a missing-indicator per feature. Models: smoothed road-class frequency → regularised logistic regression → gradient-boosted trees with isotonic calibration fitted on a separate calibration split. Intervals come from bootstrap resampling (conformal intervals are a Could-have).

Conflicting observations on one edge widen the interval rather than being averaged away; a distribution-shift detector (feature ranges outside training support) switches the edge to the conservative rule-based bound.

### 8.2 Risk- and staleness-adjusted edge cost

Carried over unchanged from the original architecture, where a\_e is the age penalty of the newest evidence on edge e:

```latex
c_e = t_e + \lambda_r \cdot \left(-\log \max(p_e,\, 0.01)\right) + \lambda_s \cdot a_e
```

The −log term makes route cost additive in log-survival, so the shortest risk-adjusted path is also the most reliable path when λ\_r dominates. Route survival is reported as the product of edge probabilities — an independence assumption stated in the limitations.

### 8.3 Robust equitable allocation

Variables x\_{d,k,v} = units of commodity k delivered to demand point d by vehicle v; u\_{d,k} = unmet units (slack). For each of S sampled road-state scenarios s, a delivery counts only if its route survives in s. Hard constraints: depot inventory, vehicle capacity, route availability, time horizon, non-negativity. Equity: every demand group g must receive at least a fraction α of its demand. The objective mixes expected loss with tail risk:

```latex
\min_{x,u}\; (1-\beta)\,\frac{1}{S}\sum_{s=1}^{S} L_s(x,u) \;+\; \beta\,\mathrm{CVaR}_{0.9}\big(L_s(x,u)\big)
```

where L\_s is priority-weighted unmet demand in scenario s. β = 0 gives the nominal plan; β > 0 gives the robust plan. On timeout, CP-SAT returns its best feasible incumbent labelled non-optimal; on infeasibility, the binding constraints are returned as diagnostics.

### 8.4 Regret (the common currency)

Because the semi-synthetic benchmark knows the true edge states z, every plan can be scored against the plan an oracle would have chosen:

```latex
\mathrm{Regret}(\pi) = L\big(\pi;\, z\big) - L\big(\pi^{*}(z);\, z\big)
```

### 8.5 Value of the next field check

For candidate edge e with check cost κ\_e, re-solve a bounded plan under both outcomes and rank by expected loss reduction per unit cost:

```latex
\mathrm{VOI}_e = \frac{\hat L(\pi_0) - \big[\,p_e\,\hat L(\pi^{*}_{e\,\text{open}}) + (1-p_e)\,\hat L(\pi^{*}_{e\,\text{blocked}})\,\big]}{\kappa_e}
```

Only the top ten uncertain edges on routes, alternatives or cut sets are scored, with cached routes and a short solver limit, as in the original active-information strategy. Unsafe or impractical checks carry a cost penalty.

### 8.6 Controlled miscalibration (the core experiment)

Temperature-distort the calibrated probabilities with T ∈ {0.5, 0.67, 1, 1.5, 2}:

```latex
p_e^{(T)} = \sigma\!\left(\frac{\operatorname{logit}(p_e)}{T}\right)
```

The map is strictly monotone, so edge ranking and ROC-AUC are identical across T, while ECE and Brier change. T < 1 makes the model over-confident; T > 1 under-confident. Each distorted model is pushed through routing, allocation and VOI unchanged, and regret is recorded. A second sweep at fixed ECE with degraded ranking (feature dropout) gives the contrasting curve.

## 9. Benchmark Design and Evaluation Protocol

The benchmark is **CrisisBench-mini**: a real road network for one bounded region, overlaid with hazard footprints and a known ground-truth road state for each scenario. Known ground truth is what makes regret computable; real field labels this sparse could not support it.

### 9.1 How scenarios are built

1. **Network.** Pin one regional OpenStreetMap extract from Geofabrik (target ≤ 50,000 directed edges), with date, attribution and checksum recorded.
2. **Hazard footprints.** 12 events: some seeded from real GDACS event locations and severities, the rest synthetic footprints of matched size. Each event is a hazard raster over the region.
3. **Ground truth.** A documented generative process sets each edge's true passability from hazard intensity, road class, surface, bridge flag and slope proxy, with noise. Its parameters are fixed in Phase 2 and never shown to the model.
4. **Observations.** Noisy, partial and time-stamped reports are sampled from the ground truth: source reliability varies, some reports are stale, and a set fraction contradict each other.
5. **Demand and supply.** Demand from WorldPop population clipped to demand zones (synthetic fallback), split into priority groups; depots, inventory and vehicles from a seeded fixture.
6. **Perturbations.** Each event yields 20 instances by varying observation density, staleness, contradiction rate, demand and inventory — **240 scenario instances** in total.

A small hand-labelled real set (closures reported for one real event, if obtainable in Phase 2) is used only as an external sanity check of calibration, never as the main test set.

### 9.2 Protocol

| Protocol element | Specification |
| --- | --- |
| Split | Event-grouped: 8 events train / 2 calibration-and-validation / 2 test (160 / 40 / 40 instances); no random-only split |
| Leakage guard | No event, footprint or observation appears in more than one split; ground-truth parameters hidden from the model |
| Seeds | Every stochastic configuration run with 3 seeds; scenario sampling S = 50 road-state samples per robust plan |
| Pairing | Every method sees the identical instance, snapshot and samples, so differences are attributable to the method |
| Run registry | Code revision, input hashes, seed, model version, solver config, hardware and wall time per run |
| Compute budget | 4 CPU cores, 16 GB RAM; solver limit 30 s per allocation; full sweep target under 2 hours |
| Reporting | Mean with paired-bootstrap 95% CI per metric; per-event breakdown alongside the pooled number |

> **Statistical power note — stated up front.** The test split holds 40 instances from only 2 events, so between-event variation dominates. Differences below roughly 5 percentage points in service metrics, or 0.01 in Brier score, should be read as directional. Mitigations: paired comparisons on identical instances, 3 seeds, bootstrap intervals that resample *events* as well as instances, and a per-event table so a single event cannot carry a headline. The Limitations section states the exact test-set size rather than presenting point estimates as definitive.

### 9.3 Stress suite

Each method is also run on scripted stress cases from the original evaluation plan: missing observations, contradictions, sudden closure, doubled demand, inventory loss, disconnected graph, stale data, solver timeout, corrupt import and distribution shift. Infeasibility is reported separately from optimality.

## 10. Baselines

Every advanced method has a simple baseline that exists before it, plus an oracle upper bound that only the semi-synthetic benchmark makes possible.

| Component | Baseline | What it tests | Proposed | Oracle bound |
| --- | --- | --- | --- | --- |
| Passability | Smoothed road-class × hazard frequency | Whether learning beats a lookup table | Boosted trees + isotonic calibration | True edge probabilities from the generator |
| Passability (ablation) | Logistic regression; boosted trees uncalibrated | Value of model capacity vs value of calibration | Boosted trees + isotonic calibration | — |
| Routing | Shortest travel time, risk ignored | Lower bound on safety | Risk- and staleness-adjusted alternatives | Routing on true edge states |
| Routing (ablation) | Hard threshold: drop edges with p < 0.35, else certain | Probabilities vs open/closed thinking | Risk-adjusted cost on calibrated p | — |
| Allocation | Proportional greedy on nominal routes | Value of optimisation | Robust CP-SAT with equity floors (β > 0) | Allocation with known road state |
| Allocation (ablation) | Nominal CP-SAT (β = 0); no equity floor | Value of robustness and of equity separately | Robust equitable CP-SAT | — |
| Next check | Random uncertain edge | Whether ranking is informative at all | Value-of-information per unit cost | Perfect information on all edges |
| Next check (ablation) | Highest-uncertainty edge (p closest to 0.5) | Decision value vs plain uncertainty | Value-of-information per unit cost | — |

The 0.35 threshold matches `minimum_edge_passability` in the original API example.

## 11. Evaluation Metrics

Primary endpoints decide the hypotheses; secondary endpoints are reported but never promoted to headlines after the fact.

| Tier | Metric | Definition | Tests |
| --- | --- | --- | --- |
| Primary | Brier score | Mean squared error between p\_e and the true edge state | H1 |
| Primary | Expected calibration error (ECE) | Weighted gap between predicted and observed passability over 10 equal-mass bins | H1, H2 |
| Primary | Decision regret | Loss of the chosen plan minus loss of the oracle plan, on true road states (Section 8.4) | H2, H5 |
| Primary | Blocked-edge exposure | Share of planned route-kilometres on edges that are truly blocked, at matched travel budget | H3 |
| Primary | Worst-group served fraction | Lowest served share of demand across priority groups, at matched inventory | H4 |
| Primary | Regret reduction per unit cost | Cumulative regret reduction after k checks divided by total check cost, k = 1…5 | H5 |
| Secondary | PR-AUC, ROC-AUC, log loss, subgroup calibration | Ranking quality and calibration by road class and hazard band | H1, H2 |
| Secondary | Median ETA inflation | Median travel-time increase of the chosen route vs shortest time | H3 guard |
| Secondary | Total served demand; weighted unmet need | Overall service and priority-weighted shortfall | H4 guard |
| Secondary | Route diversity | Mean pairwise edge-overlap (Jaccard) between alternatives | Routing |
| Secondary | Plan stability | Share of deliveries unchanged after one new observation | Robustness |
| Secondary | Runtime; infeasibility rate | Wall time per stage; share of runs with no feasible plan | Feasibility |
| Secondary | Operator comprehension | Correct answers on a 5-question explanation quiz by 5 peer testers | Explanations |

**Success criteria (pre-registered).** H1–H5 pass at the thresholds in Section 4. Performance budgets from the PRD hold: read p95 < 500 ms; route generation < 3 s on a 50,000-edge graph; allocation < 30 s for 100 demand nodes and 20 vehicles. No proxy metric is ever described as lives saved.

## 12. Tech Stack and Implementation Plan

A modular monolith on open-source tools, CPU-only, runnable on a 4-core / 16 GB laptop. No Kubernetes, Kafka, graph database or deep-learning serving during the MVP.

### 12.1 Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React, TypeScript, Vite, MapLibre GL JS, TanStack Query | Typed contracts, open map rendering, server cache without a global store |
| Backend | FastAPI, Pydantic, SQLAlchemy, Alembic | Python validation next to the ML and optimisation code |
| Database | PostgreSQL 16 + PostGIS | Transactions, spatial indexes (GiST), immutable versions |
| Graph | NetworkX snapshots | Fast to build at ≤ 50k edges; no graph server unless profiling demands one |
| ML | pandas, scikit-learn, optional LightGBM | Calibrated tabular models on CPU with fixed seeds |
| Optimisation | OR-Tools CP-SAT | Open source, time limits, feasible incumbents, infeasibility detail |
| Jobs | Redis + RQ | Simple, observable background execution; idempotent by input hash |
| Testing | pytest, Hypothesis, Schemathesis, Vitest, Playwright | Unit, property, contract, component and E2E coverage |
| CI / quality | GitHub Actions, Ruff, mypy, ESLint, Prettier | Deterministic checks on every pull request |
| Observability | JSON logs, OpenTelemetry, Prometheus metrics | Correlation IDs across API and jobs |

### 12.2 Team ownership

| Area | Member 1 (platform, data, graph) | Member 2 (intelligence, optimisation, client) |
| --- | --- | --- |
| Backend modules | `api`, `domain`, `ingestion`, `graph`, `security`, `jobs` | `ml`, `optimization`, `information` |
| Frontend | — | `frontend/src` (map, scenario, plan, explanation, health) |
| Research | Benchmark generator, snapshots, run manifests | Models, calibration, sweeps, metrics, plots |
| Contracts | Merges OpenAPI and JSON Schema | Generates typed clients from tagged contracts |
| Shared | Contract review, fixtures, integration, release | Contract review, fixtures, integration, release |

### 12.3 Working rules

- Protected `main` is always demoable; branches `m1/<issue>-<slug>` and `m2/<issue>-<slug>`; conventional commits; squash merge after the other member's review and green lint, type, unit and contract checks.
- CODEOWNERS enforces the split above; contracts, deployment and release need both members.
- Integration runs against mocks from Day 4 and against real services from Day 12.
- Daily rhythm: 09:15 contract check · 09:30 independent build · 14:30 integration · 16:30 automated tests · 17:15 evidence and risk update.
- A blocked member switches to owned tests, fixtures, accessibility, observability, experiment manifests or documentation — never idles.
- A task is done only when code, tests, usage evidence, contract impact and failure behaviour are reviewable.

## 13. Eight-Phase Execution Plan

The 56 working days run as eight phases of seven days each, every phase ending in a hard gate. A phase is not "done" by date: it is done when its gate passes, and a failed gate triggers its listed cut, never a silent slip. Day numbers map one-to-one onto the original 56-day plan, so its daily checklist and owned files stay valid.

&#91;embedded content: Execution roadmap · 8 phases, 8 gates, 56 working days\]

Each band names its phase, its days and what it delivers; the diamond line is the gate that must pass before the next phase starts.

### Phase 1 — Foundation and Contracts (Days 1–7) · Gate: Architecture Ready

**Objective:** lock scope, freeze the research protocol, and ship a mock vertical slice so both members build in parallel from Day 4.

| Track | Work | Key files |
| --- | --- | --- |
| Member 1 | Glossary and acceptance tests; backend scaffold and CI; scenario and import JSON Schemas; mock scenario API; PostGIS core migration; RBAC and audit middleware; publish OpenAPI and seed DB | `docs/decisions/001-scope.md`, `backend/pyproject.toml`, `contracts/scenario.schema.json`, `backend/app/api/scenarios.py`, `backend/migrations/001_core.sql`, `backend/app/security/auth.py`, `contracts/openapi.json` |
| Member 2 | User flow and research map; frontend scaffold and tests; fixtures and generated client types; dashboard from mock; data-status states; sign-in and route guards; accessibility and E2E smoke | `docs/product/user-flow.md`, `frontend/package.json`, `contracts/fixtures/scenario.json`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/auth/guards.tsx`, `tests/e2e/smoke.spec.ts` |
| Research (shared) | Two-day literature re-check of the gap claim; pre-register H1–H5 thresholds, split rule and seeds in `docs/research/preregistration.md`; pick and pin the study region | `docs/research/preregistration.md` |

**Exit gate:** repository, decision records, contracts and mock slice exist; lint, type, contract and E2E smoke pass from the seeded scenario; pre-registration committed and tagged. **If the gate fails:** freeze all scope until the mock slice passes; nothing else starts.

### Phase 2 — Data, Snapshots, Graph and Benchmark (Days 8–14) · Gate: Data Ready

**Objective:** validated, immutable data in; a directed graph out; the CrisisBench-mini generator producing ground truth.

| Track | Work | Key files |
| --- | --- | --- |
| Member 1 | Hashed upload registry; CSV validation with row quarantine; GeoJSON and bounds validation; immutable content-addressed snapshots; directed graph builder; graph serialisation with metadata hash; import-to-map integration test | `backend/app/ingestion/uploads.py`, `csv.py`, `geojson.py`, `snapshots.py`, `backend/app/graph/build.py`, `store.py`, `tests/integration/test_ingest_graph.py` |
| Member 2 | Import wizard; validation summary table; map data preview; source/version timeline; graph-job status view; road-edge map layer; empty, error and loading states | `frontend/src/pages/ImportWizard.tsx`, `components/ValidationTable.tsx`, `MapPreview.tsx`, `VersionTimeline.tsx`, `map/RoadLayer.tsx`, `tests/e2e/import-map.spec.ts` |
| Research (M1 lead, M2 review) | Ground-truth generator and hazard footprints for 12 events; observation sampler (reliability, staleness, contradictions); fix and hide generator parameters; build 240 instances; freeze event-grouped split | `experiments/bench/generate.py`, `experiments/bench/observations.py`, `data/bench/manifest.json` |

**Exit gate:** quarantine and reproducibility tests pass; the same inputs yield the same snapshot and graph hashes; benchmark manifest lists 240 instances with split labels and a leakage check. **If the gate fails:** fall back to the shipped fixture region, cut optional sources, and keep the generator.

### Phase 3 — First Intelligence (Days 15–21) · Gate: First Intelligence

**Objective:** observations change the graph, baseline routes work, and a calibrated passability model exists with honest metrics.

| Track | Work | Key files |
| --- | --- | --- |
| Member 1 | Observation CRUD that creates a new graph version; travel-time Dijkstra; Yen-style diverse alternatives; versioned edge-feature API; grouped-split harness; model registry API; attach predictions to graph | `backend/app/domain/observations.py`, `backend/app/graph/routing.py`, `alternatives.py`, `backend/app/ml/features.py`, `backend/app/ml/registry.py`, `experiments/splits.py` |
| Member 2 | Observation editor; route request panel; route comparison view; model status page; train frequency and logistic baselines; fit boosted trees and isotonic calibration; reliability diagrams; uncertainty layer on map and routes | `frontend/src/components/ObservationEditor.tsx`, `RouteComparison.tsx`, `pages/ModelStatus.tsx`, `experiments/train_baselines.py`, `experiments/calibrate.py`, `frontend/src/map/UncertaintyLayer.tsx` |
| Research | First validation-split Brier, ECE and AUC for all three models; leakage guard test; model card draft | `reports/model_card.md` |

**Exit gate:** group-split and route tests pass; every prediction carries probability, interval, model version and feature summary; validation metrics logged with run manifests. **If the gate fails:** ship the frequency baseline end to end while repairing the boosted model; routing proceeds on baseline probabilities.

### Phase 4 — End-to-End MVP (Days 22–28) · Gate: End-to-End MVP

**Objective:** a full import → risk-aware route → feasible allocation flow through the UI, with baselines in place.

| Track | Work | Key files |
| --- | --- | --- |
| Member 1 | Risk- and staleness-adjusted edge cost; demand, inventory and vehicle APIs; import-to-allocation integration test | `backend/app/graph/costs.py`, `backend/app/api/resources.py`, `tests/integration/test_vertical_slice.py` |
| Member 2 | Proportional greedy baseline; CP-SAT variables and hard constraints; objective with equity floors; timeout and infeasibility diagnostics; critical-edge explanation; resource grids; allocation, solver-config, equity and diagnostics panels; full-scenario E2E | `backend/app/optimization/baseline.py`, `model.py`, `objective.py`, `diagnostics.py`, `frontend/src/components/CriticalEdges.tsx`, `AllocationTable.tsx`, `EquityMetrics.tsx`, `SolverDiagnostics.tsx`, `tests/e2e/vertical-slice.spec.ts` |
| Research | Hard-threshold and shortest-time routing baselines wired into the harness; property tests for capacity conservation and non-negativity | `experiments/baselines_routing.py` |

Note: the original plan put optimisation code under Member 1 on Days 24–27 while the TRD assigns `optimization` to Member 2. This blueprint follows the TRD; Member 1 owns costs and resource APIs instead.

**Exit gate:** seeded E2E passes from import to an allocation plan in the UI; solver returns either a feasible plan, a labelled non-optimal incumbent, or diagnostics — never a silent failure. **If the gate fails:** cut optional UI panels and repair the slice; greedy allocation is the fallback plan.

### Phase 5 — Decision Intelligence (Days 29–35) · Gate: Decision Intelligence

**Objective:** plans that hold up under uncertainty, explain themselves, and say which check to make next.

| Track | Work | Key files |
| --- | --- | --- |
| Member 1 | Immutable what-if deltas on cloned scenarios; serialise binding constraints and rejected choices; enumerate observable uncertain edges; decision-loop integration test | `backend/app/domain/simulation.py`, `explain.py`, `backend/app/information/candidates.py`, `tests/integration/test_decision_loop.py` |
| Member 2 | Road-state scenario sampler (S = 50); robust objective with CVaR term; nominal vs robust comparison; value-of-information estimator; assumptions editor; what-if workspace; explanation page; reconnaissance table and cost/value explanation | `backend/app/optimization/scenarios.py`, `robust.py`, `backend/app/information/value.py`, `frontend/src/pages/Simulation.tsx`, `Explanation.tsx`, `components/ReconTable.tsx` |
| Research | Ablation smoke run: β = 0 vs β > 0, equity floor on/off, VOI vs random on 10 validation instances | `experiments/smoke_ablation.py` |

**Exit gate:** robust plan, explanation and ranked information action produced for the seeded scenario; scenario and ablation smoke tests pass; a new observation visibly flags "decision changed / unchanged". **If the gate fails:** keep robust allocation; simplify VOI to two outcomes with cached routes only.

### Phase 6 — System Hardening (Days 36–42) · Gate: System Ready

**Objective:** the system is safe to show: approvals, security limits, observability, recovery and a production-like deployment.

| Track | Work | Key files |
| --- | --- | --- |
| Member 1 | Submit / approve / reject with rationale; upload limits, sanitisation, rate limits; JSON logs, metrics, correlation IDs; profile graph, DB and API; retry and idempotency rules; production-like Compose with backup; seeded system and restore test | `backend/app/domain/approval.py`, `backend/app/security/hardening.py`, `backend/app/observability.py`, `backend/app/jobs/recovery.py`, `docker/compose.prod.yml`, `tests/system/test_seeded_scenario.py` |
| Member 2 | Approver page; malicious-input and auth tests; system-health view; map and large-table profiling; recoverable-failure UX; runtime config; browser and accessibility suite | `frontend/src/pages/Approval.tsx`, `tests/security/test_inputs.py`, `frontend/src/pages/SystemHealth.tsx`, `components/RecoveryActions.tsx`, `tests/e2e/system-gate.spec.ts` |
| Research | Performance budgets checked against the PRD (p95 < 500 ms reads, < 3 s routes, < 30 s allocation) | `benchmarks/backend_profile.py`, `frontend_profile.ts` |

**Exit gate:** restore, auth, load and system E2E pass; hostile archive, traversal, injection and oversized-geometry tests pass; approval impossible without role and rationale. **If the gate fails:** stop all feature work and harden until it passes.

### Phase 7 — Evidence (Days 43–49) · Gate: Evidence Ready

**Objective:** run the frozen protocol once on the test split, including the controlled-miscalibration sweep, and audit every claim.

| Track | Work | Key files |
| --- | --- | --- |
| Member 1 | Freeze snapshots and run manifests; run passability, routing, allocation and information experiments across 3 seeds; data and graph stress suite; regenerate result tables from manifests | `experiments/manifest.py`, `run_passability.py`, `run_routing.py`, `run_allocation.py`, `run_information.py`, `run_stress.py`, `reports/result_manifest.json` |
| Member 2 | Metrics and plots; temperature sweep T ∈ {0.5, 0.67, 1, 1.5, 2} and the fixed-ECE ranking sweep; calibration-slice, time/risk/diversity, service/equity/runtime and regret-per-cost analyses; UI and job recovery stress; claim-to-evidence audit | `experiments/report.py`, `experiments/run_miscalibration.py`, `reports/*_results.md`, `tests/e2e/stress.spec.ts`, `docs/claim_evidence_map.md` |
| Research | Paired-bootstrap CIs resampling events and instances; per-event tables; negative results written up as results | `reports/limitations.md` |

**Exit gate:** every number in the report traces to a manifest, snapshot hash, code revision and CI; H1–H5 each marked pass, fail or inconclusive against pre-registered thresholds. **If the gate fails:** shrink the sweep grid (fewer T values, 1 seed for stress), but never drop H2 or a primary endpoint.

### Phase 8 — Release and Defence (Days 50–56) · Gate: Demo Ready

**Objective:** a tagged release that runs on a clean machine, a 12-minute demo that survives failure, and a report that claims only what was measured.

| Track | Work | Key files |
| --- | --- | --- |
| Member 1 | Tag release candidate and close blockers; demo seed and reset tool; architecture and metric figures; setup, API, ops docs and model card; timing run; offline fallback and restore drill; verify hashes, migrations, tests and final tag | `CHANGELOG.md`, `scripts/reset_demo.py`, `docs/figures/`, `README.md`, `docs/demo/fallback_runbook.md`, `release/manifest.json` |
| Member 2 | Freeze copy and accessibility; operator script; presentation narrative and backup media; user guide; comprehension test with peers; keyboard-only demo path; verify evidence links and final package | `docs/demo/operator_script.md`, `docs/presentation/outline.md`, `docs/user_guide.md`, `docs/demo/usability_log.md`, `release/final_checklist.md` |
| Research | Final report in paper structure: problem, protocol, results with intervals, limitations, negative results | `reports/final_report.md` |

**Exit gate:** clean-machine run from README succeeds; two full rehearsals inside 12 minutes; backup recording and screenshots ready; no external API needed for the demo. **If the gate fails:** demo from the deterministic offline fallback and recorded run.

### 13.9 Cut order if time runs short

Cut in this order: extra data sources → visual polish → advanced intervals (conformal) → information-action polish → stress-suite breadth. **Never cut:** baselines, integration, uncertainty disclosure, the H2 sweep, evaluation, or approval.

## 14. Risk Register

Twelve risks, each with an early-warning signal, a mitigation, a fallback and one owner. Three are new in this blueprint (realism, workload, a null H2); the rest carry over from the original register.

| Risk | P | I | Early warning | Mitigation | Fallback | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| Semi-synthetic results don't transfer to real roads | High | High | Reviewer questions realism | Generator documented and parameter-swept; small real-event sanity check of calibration | State it as the main limitation; claim protocol, not field accuracy | Shared |
| Member 2 overloaded (frontend + ML + optimisation) | High | High | M2 tasks slip 2 days in a row in Phase 4–5 | M1 takes benchmark generator, experiment runners and VOI candidate code | Cut UI polish before any research task | Shared |
| Sparse or imbalanced labels | High | High | Low blocked-edge count by Day 14 | Generator controls base rate; class-balanced calibration bins | Rule-based bounds per road class | Member 2 |
| Temperature sweep shows no effect (H2 null) | Medium | Medium | Flat regret curve on validation | Check sweep range is wide enough; check plan actually uses probabilities | Report as a clean negative result | Member 2 |
| Graph too large | Medium | High | Build over 10 minutes | Clip region, simplify, cache | Curated 50k-edge extract | Member 1 |
| Solver infeasible or slow | Medium | High | Repeated no-plan results | Unmet-demand slack, diagnostics, 30 s limit | Greedy feasible plan | Member 2 |
| Contract drift | Medium | High | Failing fixtures | Versioned schemas, CODEOWNERS | Freeze contract v1 | Member 1 |
| Stale or conflicting data | High | High | Conflict and age flags | Widen uncertainty, staleness penalty | Conservative exclusion | Shared |
| Integration delay | Medium | High | Day 28 slice fails | Daily E2E from Day 4 | Cut stretch scope | Shared |
| Map performance | Medium | Medium | Below 30 FPS | Tiles, clustering, virtualised tables | Smaller region | Member 2 |
| Sensitive locations exposed | Low | High | Real identifiers appear in logs or demo | Synthetic demo data, RBAC, redacted logs | Offline fixtures only | Member 1 |
| Compute overrun | Low | Medium | Sweep over 2 hours | Bounded search, cached routes | Fixed small model, fewer T values | Member 2 |

P = probability, I = impact.

## 15. Security, Ethics and Scope Control

CrisisRoute supports a life-critical decision, so every safeguard below is a gate requirement, not a nice-to-have. The interface states on every plan that it supports decisions and does not certify route safety.

### 15.1 Threats and safeguards

| Threat | Harm | Mitigation | Evidence it works |
| --- | --- | --- | --- |
| Hostile upload | Path traversal, zip bomb, parser exploit | Type, size, row and expansion limits; quarantine; sanitised filenames | Adversarial ingestion tests |
| Unauthorised approval | Unsafe plan executed | RBAC, mandatory rationale, immutable audit log | Role-matrix tests |
| False recommendation | Operational harm | Alternatives, uncertainty and data age always shown; human approval | Explanation-completeness test blocks approval if missing |
| Stale evidence | Route through a closed road | Age policy and staleness cost penalty | Stale-data stress test |
| Under-service | Inequity between groups | Service floors and worst-group metric | Equity ablation |
| Sensitive locations | Disclosure of shelters or people | Synthetic demo data, least privilege, redacted logs | Privacy and log review |
| Model poisoning | Bad predictions | Provenance, artifact hashes, registry review | Artifact integrity test |
| Denial of service | Planning unavailable | Rate limits, bounded jobs, cache | Load and timeout tests |

Operations: Argon2id password hashing, short-lived sessions, parameterised SQL, restricted CORS; daily backups of database and manifests with a restore drill in Phase 6; pinned containers, dependency scanning, no secrets in Git. On any external failure, the last valid snapshot is kept and its age shown.

### 15.2 Data ethics and licensing

Every record carries source ID or URL, retrieval time, observation time, licence, content hash and snapshot ID. OpenStreetMap data is used under ODbL with attribution; HDX, ReliefWeb, GDACS and WorldPop terms are checked and recorded per dataset in Phase 2. A source is never treated as real-time unless its timestamp proves it. The repository ships a small reproducible fixture so no external access can block development or the demo.

### 15.3 Scope

| Priority | Items |
| --- | --- |
| Must have | Validated imports; immutable snapshots; directed graph; observations; route baseline and alternatives; calibrated passability (baseline and final); allocation (baseline and robust); uncertainty and explanation UI; what-if; approval and audit; CrisisBench-mini; controlled-miscalibration sweep; reproducible evaluation |
| Should have | Value-of-information ranking; source health; accessible map/table parity; production-like local deployment |
| Could have | Extra hazard layers; conformal intervals; tile caching; batch comparison; a decision-focused (SPO+) training arm |
| Will not have | Live dispatch; autonomous navigation; drones; unrestricted social-media ingestion; nationwide scale; foundation-model training; mobile app; Kubernetes; any guaranteed-safety claim |

The system does not predict disasters, perform medical triage, navigate vehicles, certify roads, monitor citizens or replace emergency coordinators.

## 16. Expected Contributions

- **A measured answer to "does calibration matter for relief decisions?"** — a regret-versus-ECE curve at fixed ranking accuracy, on a coupled routing and allocation problem with equity floors.
- **CrisisBench-mini** — an open, regenerable benchmark of 240 scenario instances with known ground truth, event-grouped splits and stress cases, reusable by anyone testing predict-then-optimise methods under uncertain road access.
- **A working decision-support system** — calibrated passability, risk-aware alternatives, robust equitable allocation, ranked next checks and an audit-ready approval flow, runnable on a student laptop.
- **Evidence on value of information** — whether decision-value ranking of field checks beats plain uncertainty ranking, and how much miscalibration erodes that advantage.
- **A clean negative-result path.** If regret does not track calibration error, that is publishable evidence that ranking quality, not calibration, is what relief tools should optimise — useful either way.

## 17. Deliverables Checklist

Tick each item only when its evidence (test run, manifest or file) is linked.

- [ ] Pre-registration of H1–H5 thresholds, split rule and seeds (Phase 1)
- [ ] CrisisBench-mini: generator, 240 instances, split manifest, leakage check (Phase 2)
- [ ] Versioned snapshot → graph pipeline with quarantine and reproducible hashes (Phase 2)
- [ ] Frequency, logistic and calibrated boosted passability models with model card (Phase 3)
- [ ] Risk-aware routing with three alternatives; shortest-time and hard-threshold baselines (Phases 3–4)
- [ ] Greedy, nominal CP-SAT and robust equitable allocators with diagnostics (Phases 4–5)
- [ ] Value-of-information ranking with random and highest-uncertainty baselines (Phase 5)
- [ ] What-if cloning, explanation page and approval workflow with audit log (Phases 5–6)
- [ ] Security, restore, load and accessibility test suites passing (Phase 6)
- [ ] Controlled-miscalibration sweep and fixed-ECE ranking sweep (Phase 7)
- [ ] Result tables regenerated from manifests with paired-bootstrap CIs and per-event breakdown (Phase 7)
- [ ] Claim-to-evidence map and limitations section (Phase 7)
- [ ] Final report, 12-minute demo, 12-slide deck, backup recording (Phase 8)
- [ ] Tagged public repository with README, setup, API, ops and user guides, crediting OSM, OR-Tools and data providers (Phase 8)

## 18. Glossary

| Term | Meaning |
| --- | --- |
| Passability probability (p\_e) | Model estimate that road edge e is usable at decision time, given the evidence |
| Calibration | Agreement between predicted probabilities and observed frequencies: of edges given 0.7, about 70% should be passable |
| Expected calibration error (ECE) | Weighted average gap between predicted and observed rates across probability bins |
| Brier score | Mean squared error of probabilistic predictions; rewards both calibration and sharpness |
| Isotonic calibration | Non-parametric, monotone mapping from raw scores to calibrated probabilities |
| Temperature scaling | Dividing logits by T; changes confidence without changing ranking |
| Controlled miscalibration | Deliberately distorting calibration at fixed ranking accuracy to isolate its effect on decisions |
| Predict-then-optimise | Pipeline where a model's predictions feed an optimiser as inputs |
| Decision-focused learning | Training a model on the quality of the decisions its predictions produce |
| Regret | Loss of the chosen plan minus loss of the best plan given the true state |
| CVaR | Conditional value-at-risk: average loss in the worst tail of scenarios |
| Robust allocation | Allocation optimised across many sampled road states, not one assumed network |
| Service floor | Minimum share of each group's demand that must be met |
| Value of information (VOI) | Expected improvement in a decision from observing something before deciding |
| Snapshot | Immutable, hashed copy of all inputs used by a scenario |
| Event-grouped split | Train/validation/test split by disaster event, so no event leaks across splits |
| CP-SAT | OR-Tools constraint-programming solver used for allocation |
| Canadian Traveller Problem | Shortest-path problem where some roads may be blocked and are revealed only when reached |

## 19. References

Bibliographic details marked with a link were checked against the linked page on 2 Nov 2026; unlinked classics are cited from standard records and should be re-checked before submission.

1. A. Ben-Tal, B. Do Chung, S. R. Mandala, T. Yao, "Robust optimization for emergency logistics planning: Risk mitigation in humanitarian relief supply chains," *Transportation Research Part B* 45(8): 1177–1189, 2011. [link](https://econpapers.repec.org/RePEc:eee:transb:v:45:y:2011:i:8:p:1177-1189)
2. R. C. B. Bucar, Y. M. Hayeri, "Quantitative flood risk evaluation to improve drivers' route choice decisions during disruptive precipitation," *Reliability Engineering & System Safety* 219, 2022. [link](https://ideas.repec.org/a/eee/reensy/v219y2022ics0951832021006803.html)
3. J. C. Duque, I. S. Dolinskaya, K. Sörensen, "Network repair crew scheduling and routing for emergency relief distribution problem," *European Journal of Operational Research* 248(1): 272–285, 2016. [link](https://econpapers.repec.org/RePEc:eee:ejores:v:248:y:2016:i:1:p:272-285)
4. A. N. Elmachtoub, P. Grigas, "Smart 'Predict, then Optimize'," *Management Science* 68(1): 9–26, 2022. [link](https://econpapers.repec.org/RePEc:inm:ormnsc:v:68:y:2022:i:1:p:9-26)
5. C. Guo, G. Pleiss, Y. Sun, K. Q. Weinberger, "On Calibration of Modern Neural Networks," ICML 2017. [link](https://proceedings.mlr.press/v70/guo17a)
6. W. J. Gutjahr, S. Fischer, "Equity and deprivation costs in humanitarian logistics," *European Journal of Operational Research* 270(1): 185–197, 2018. [link](https://econpapers.repec.org/RePEc:eee:ejores:v:270:y:2018:i:1:p:185-197)
7. J. Holguín-Veras, N. Pérez, M. Jaller, L. N. Van Wassenhove, F. Aros-Vera, "On the appropriate objective function for post-disaster humanitarian logistics models," *Journal of Operations Management* 31(5): 262–280, 2013. [link](https://itspubs.ucdavis.edu/publication_detail.php?id=2372)
8. R. A. Howard, "Information Value Theory," *IEEE Transactions on Systems Science and Cybernetics* 2(1): 22–26, 1966.
9. J. Mandi et al., "Decision-Focused Learning: Foundations, State of the Art, Benchmark and Future Opportunities," *Journal of Artificial Intelligence Research*, 2024. [link](https://mlanthology.org/jair/2024/mandi2024jair-decisionfocused)
10. A. Niculescu-Mizil, R. Caruana, "Predicting Good Probabilities with Supervised Learning," ICML 2005. [link](https://mlanthology.org/icml/2005/niculescumizil2005icml-predicting)
11. C. H. Papadimitriou, M. Yannakakis, "Shortest paths without a map," Proc. 16th ICALP, LNCS 372: 610–620, 1989. [link](https://en.wikipedia.org/wiki/Canadian_traveller_problem)
12. R. T. Rockafellar, S. Uryasev, "Optimization of conditional value-at-risk," *Journal of Risk* 2(3): 21–41, 2000.
13. J. Y. Yen, "Finding the K shortest loopless paths in a network," *Management Science* 17(11): 712–716, 1971.
14. S. Zhao, M. P. Kim, R. Sahoo, T. Ma, S. Ermon, "Calibrating Predictions to Decisions: A Novel Approach to Multi-Class Calibration," NeurIPS 2021. [link](https://proceedings.neurips.cc/paper/2021/hash/bbc92a647199b832ec90d7cf57074e9e-Abstract.html)
15. HeiGIT, "AILAS — AI Logistic Awareness System" (project page). [link](https://heigit.org/AILAS/)

**Data and tools:** [OpenStreetMap copyright](https://www.openstreetmap.org/copyright) · [Geofabrik extracts](https://download.geofabrik.de/) · [HDX HAPI](https://hapi.humdata.org/) · [ReliefWeb API](https://apidoc.reliefweb.int/) · [GDACS](https://www.gdacs.org/) · [WorldPop](https://www.worldpop.org/) · [OR-Tools](https://developers.google.com/optimization) · [PostGIS](https://postgis.net/documentation/) · [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)

## 20. Attribution and Originality

> **Declaration.** This research blueprint — the literature synthesis, the calibration-to-decision research gap, the controlled-miscalibration protocol, CrisisBench-mini and the CrisisRoute system design — is an original proposal by the CrisisRoute two-person team. It consolidates and extends the team's earlier 31-file, 56-day CrisisRoute plan into one document with eight gated phases.
>
> All cited works remain the intellectual property of their authors and institutions. OpenStreetMap data © OpenStreetMap contributors, available under the Open Database License; other datasets are used under their stated terms. This document builds on their published, open findings and makes no claim of operational safety.
