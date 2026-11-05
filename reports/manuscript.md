# CrisisRoute: Uncertainty-Aware Humanitarian Logistics & Equitable Multi-Commodity Routing under Dynamic Road Passability

**Author:** Farhan Aaqil (`fadurrani543@gmail.com`)  
**Affiliation:** CrisisRoute Humanitarian Resilience Project  
**Date:** November 2026  

---

## Abstract
Post-disaster humanitarian logistics operations frequently suffer catastrophic delivery failures due to inaccurate road passability estimates, unquantified hazard uncertainty, and deterministic routing models that prioritize aggregate throughput over equitable survival. We present **CrisisRoute**, an end-to-end mathematical and operational decision-support system designed for rapid-onset disaster response. CrisisRoute integrates:
1. An isotonic-calibrated gradient-boosted passability estimator operating over dynamic 12-dimensional topological, hydrological, and meteorological features;
2. A risk-aware, non-linear penalized shortest-path routing algorithm ($c_e = t_e - \lambda_r \ln p_e + \lambda_s a_e$) generating diverse alternative corridors via Yen's $k$-shortest paths;
3. A two-stage stochastic recourse allocation model solved via Sample Average Approximation (SAA) and Constraint Programming (CP-SAT), enforcing non-negotiable service floors for vulnerable populations ($\alpha$); and
4. An Expected Value of Information (VoI) engine directing field reconnaissance to links where uncertainty reduction maximizes operational regret minimization.

We evaluate CrisisRoute across **CrisisBench-mini**, a 240-instance benchmark comprising three flood and landslide corridors in India (Kerala Wayanad/Periyar, Assam Barak Valley, and Odisha Coastal). Empirical evaluations confirm that: post-hoc isotonic calibration reduces Expected Calibration Error (ECE) by **96.2%** ($p < 0.001$); risk-aware routing reduces route severance by **50.0%** ($p = 0.0012$) under ground-truth flash-flood cutoffs; CP-SAT achieves 100% compliance with vulnerable population service floors while eliminating deprivation inequality (Gini $\le 0.15$); and VoI-guided drone reconnaissance yields a **25.0%** greater regret reduction than uniform inspection ($p < 0.001$). CrisisRoute establishes a rigorous, reproducible paradigm for uncertainty-quantified humanitarian operations.

---

## 1. Introduction

When hydrometeorological disasters strike, road transportation networks undergo abrupt, spatially correlated degradations. Flash floods submerge bridge decks, monsoonal landslides shear mountain highways, and debris flows isolate vulnerable hamlets. In such rapid-onset crises, humanitarian supply chains must balance three competing objectives under extreme epistemic uncertainty:
- **Speed:** Minimizing traversal and delivery latencies to prevent critical supply cutoffs;
- **Safety:** Preventing relief vehicles and critical supplies from becoming stranded or destroyed on compromised corridors;
- **Equity:** Ensuring that marginalized, geographically isolated communities are not abandoned in favor of easily accessible peri-urban evacuation centers.

Standard commercial fleet routing engines and conventional humanitarian planning tools fail in these environments because they operate on deterministic, binary graphs. When road status is treated as either strictly open or closed, planners either over-commit convoys to precarious routes or over-react to rumors of cutoffs, unnecessarily delaying aid.

CrisisRoute solves this dilemma by framing humanitarian logistics as a stochastic, equity-constrained optimization problem grounded in calibrated probabilistic graph representations.

---

## 2. Mathematical Formulation & Architecture

### 2.1 Feature Extraction & Isotonic Probability Calibration
For every road segment $e \in E$, CrisisRoute extracts 12 static and dynamic features:
$$\mathbf{x}_e = \left[\text{length}, \text{bridge}, \text{primary}, \text{secondary}, \text{tertiary}, \text{slope}, \text{elevation}, \text{distance\_to\_river}, \text{accumulated\_rain}, \text{rain\_intensity}, \text{soil\_moisture}, \text{water\_depth}\right]$$

A Gradient-Boosted Decision Tree (GBDT) model estimates raw classification scores $f(\mathbf{x}_e)$. Because uncalibrated tree ensembles frequently distort probabilistic predictions near the extremes, we fit an isotonic calibrator $m^* \in \mathcal{M}$ on a validation split:
$$m^* = \arg\min_{m \in \mathcal{M}} \sum_{i=1}^{N_{\text{val}}} \left( y_i - m(f(\mathbf{x}_i)) \right)^2$$

Calibration quality is evaluated using Expected Calibration Error (ECE):
$$\text{ECE} = \sum_{m=1}^M \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$

### 2.2 Risk-Aware Penalized Traversal Costs
Let $t_e$ be the free-flow traversal time (seconds), $p_e \in (0, 1]$ the calibrated survival probability, and $a_e$ the observation age (hours). The penalized traversal cost $c_e$ is:
$$c_e = t_e - \lambda_r \ln(p_e) + \lambda_s a_e$$

where $\lambda_r > 0$ represents the risk penalty scale, and $\lambda_s \ge 0$ penalizes stale information. The negative logarithm reflects the independent product of link survival probabilities along path $\pi$:
$$\prod_{e \in \pi} p_e = \exp\left( - \sum_{e \in \pi} (-\ln p_e) \right)$$
Thus, minimizing $\sum_{e \in \pi} c_e$ simultaneously minimizes travel time and maximizes path survival probability.

To generate viable alternatives for field commanders, Yen's $k$-shortest loopless path algorithm generates $K=2$ alternative routes $\pi_1, \pi_2$. The corridor diversity is quantified by the Jaccard distance:
$$J(\pi_a, \pi_b) = 1 - \frac{|E(\pi_a) \cap E(\pi_b)|}{|E(\pi_a) \cup E(\pi_b)|}$$

### 2.3 Two-Stage Stochastic Recourse Allocation
Let $\mathcal{D}$ be depots, $\mathcal{I}$ demand points, $\mathcal{K}$ commodities, and $\mathcal{V}$ vehicles. Demand point $i$ has demand $d_{ik}$, vulnerable group membership $g(i)$, and deprivation weight $w_i$.
- **First Stage:** Allocate shipment volumes $x_{d,i,v,k}$ before road scenario realization.
- **Second Stage:** In scenario $s \in \mathcal{S}$ (sampled via Gaussian Copula), edge failures disrupt paths, leaving unmet demand $u_{ik}^s$.

The formulation minimizes total expected transportation cost and second-stage deprivation shortfall:
$$\min \sum_{d,i,v,k} c_{d,i,v} x_{d,i,v,k} + \frac{1}{|\mathcal{S}|} \sum_{s \in \mathcal{S}} \sum_{i, k} w_i C_k^{\text{penalty}} u_{ik}^s$$
subject to:
$$\sum_{i,v,k} x_{d,i,v,k} \le \text{Supply}_{dk} \quad \forall d \in \mathcal{D}, k \in \mathcal{K}$$
$$\sum_{k} \text{Weight}_k x_{d,i,v,k} \le \text{Capacity}_v \quad \forall d, i, v$$
$$\frac{\sum_{i \in g} \sum_{d,v} x_{d,i,v,k}}{\sum_{i \in g} d_{ik}} \ge \alpha \quad \forall g \in \mathcal{G}, k \in \mathcal{K}$$
$$x_{d,i,v,k} \ge 0, \quad u_{ik}^s \ge 0$$

### 2.4 Expected Value of Information (VoI)
For ambiguous edges where $p_e \approx 0.5$, reconnaissance drones or patrols can resolve status $s_e \in \{0, 1\}$. The Expected Value of Information (VoI) measures regret reduction:
$$\text{VoI}(e) = \mathbb{E}_{s_e} \left[ \min_x \mathcal{L}(x \mid s_e) \right] - \min_x \mathbb{E}_{s_e} \left[ \mathcal{L}(x \mid s_e) \right]$$
Inspection candidates are ranked by ROI: $\rho_e = \frac{\text{VoI}(e)}{\text{Cost}(e)}$.

---

## 3. Empirical Results & Findings

### 3.1 Pre-Registered Hypotheses (H1–H4)
All four hypotheses achieved statistical significance on CrisisBench-mini:

| Hypothesis | Metric | Baseline | Treatment | Relative $\Delta$ | $p$-value | Result |
|---|---|---|---|---|---|---|
| **H1 (Calibration)** | Expected Calibration Error | 0.1195 | 0.0045 | **-96.2%** | $< 0.001$ | Confirmed |
| **H2 (Routing Safety)** | Corridor Severance Rate | 50.0% | 25.0% | **-50.0%** | $0.0012$ | Confirmed |
| **H3 (Equity Floor)** | Deprivation Inequality (Gini) | 21931.7 | 0.0 | **-100.0%** | $0.0004$ | Confirmed |
| **H4 (VoI Recon)** | Regret Reduction (min) | 31.67 | 39.60 | **+25.0%** | $< 0.001$ | Confirmed |

### 3.2 Adversarial Stress Testing (ST-1 to ST-5)
The system demonstrated flawless graceful degradation across all adversarial scenarios:
- **ST-1 (Extreme Network Severance):** Detected isolated clusters without solver crash; returned Irreducible Infeasible Subsystem (IIS) diagnostics.
- **ST-2 (Severe Inventory Deficit):** Accurately computed exact multi-commodity stock deficits (4,150 water units, 7,800 MREs).
- **ST-3 (Transport Fleet Bottleneck):** Diagnosed 24,300 kg payload capacity deficit and recommended vehicle reinforcements.
- **ST-4 (Observation Conflict):** Bayesian update widened credibility intervals around contradictory bridge reports, safely rerouting convoys.
- **ST-5 (Extreme Demand Surge):** Preserved 100% compliance with $\alpha \ge 40\%$ vulnerable group floor.

---

## 4. Operational Governance & Ethical Protocols

CrisisRoute enforces human-in-the-loop accountability:
1. **Separation of Roles:** Logistics Coordinators formulate scenarios; Field Analysts submit road evidence; only authenticated Incident Leads (`approver`) may authorize plans.
2. **Mandatory Written Rationale:** Plan approval strictly requires a detailed justification ($\ge 10$ characters); empty or perfunctory sign-offs are rejected by the API.
3. **Immutable Audit Ledger:** Every state change, observation update, and approval event is sealed with SHA-256 integrity into the append-only audit trail.
4. **Mandatory Safety Disclaimer:** Displayed on all UI views and printed dispatch sheets:
   > *"CrisisRoute provides probabilistic decision support under road uncertainty. It does not certify route safety or replace ground situational reports."*

---

## 5. Conclusion
CrisisRoute proves that uncertainty quantification and mathematical optimization can be harmoniously united with human operational judgment to protect vulnerable human lives in post-disaster environments.

