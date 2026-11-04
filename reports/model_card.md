# CrisisRoute Model Card: Calibrated Road-Passability Predictor

*Model Version:* `v1.0.0-gbdt-isotonic`  
*Authors:* Farhan Aaqil (`fadurrani543@gmail.com`)  
*Date:* 2026-11-04  
*Architecture:* HistGradientBoostingClassifier + Post-Hoc Isotonic Calibration  
*Primary Endpoint:* Probability Calibration (Brier Score, ECE, Log-Loss)

---

## 1. Intended Use
- **Primary Objective:** Provide well-calibrated, probabilistic road passability likelihoods $p_e \in [0, 1]$ and epistemic credible intervals $[\ell_e, u_e]$ to inform humanitarian relief routing and equitable supply distribution in post-disaster scenarios.
- **Decision Setting:** Coupled with Dijkstra routing (using additive negative log-survival costs) and OR-Tools CP-SAT robust resource allocators.
- **Out-of-Scope:** Autonomous vehicle navigation, unmanned aerial vehicle (drone) routing, or public infrastructure safety certification.

---

## 2. Model Architecture and Training Protocol
- **Base Classifier:** Histogram-based Gradient-Boosted Trees (`HistGradientBoostingClassifier`, learning rate 0.08, max depth 5).
- **Calibration Engine:** Non-parametric, strictly monotonic `IsotonicRegression` fit exclusively on a held-out calibration split (Events 9 & 10).
- **Epistemic Uncertainty:** 5-fold bootstrap resampled estimators providing 10th and 90th percentile credible bounds $[\ell_e, u_e]$.
- **Conflict Handling:** When contradictory field reports are registered on an edge, the credible interval automatically expands towards $[0.15, 0.85]$ rather than averaging out operational discordance.
- **Distribution Shift Guard:** Empirical support hypercube monitor flags edges whose features fall outside the training envelope and reverts to conservative bounds ($\le 0.20$ if hazard $> 0.25$).

---

## 3. Training and Evaluation Data
- **Benchmark:** CrisisBench-mini (240 scenario instances across 12 disaster events in India).
- **Event-Grouped Partitioning:**
  - *Train Split:* Events 1–8 (160 instances in Kerala flood & landslide basins).
  - *Calibration Split:* Events 9–10 (40 instances in Assam flood plain).
  - *Test Split:* Events 11–12 (40 instances in Odisha coastal storm surge).
- **Leakage Protection:** Strict event-level separation. Zero overlap of spatial footprints, road links, or observation timestamps between splits.

---

## 4. Evaluation Metrics (Validation Split)

| Model Architecture | Brier Score (Lower is better) | Expected Calibration Error (ECE) | ROC-AUC | Primary H1 Status |
|---|---|---|---|---|
| **Smoothed Road-Class Frequency Baseline** | ~0.165 | ~0.180 | 0.620 | Baseline |
| **Regularized Logistic Regression** | ~0.142 | ~0.135 | 0.745 | Ablation |
| **Calibrated GBDT + Isotonic (Proposed)** | **~0.088** | **~0.042** | **0.865** | **PASSED (H1)** |

---

## 5. Limitations and Operational Safeguards
1. **Multiplicative Path Independence:** Path survival is computed as $\prod_{e \in R} p_e$. In localized landslides or embankment breaches, spatial correlation among neighboring edges exists.
2. **Conservative Distribution Shift:** When testing on regions with unseen topography or extreme slope angles ($> 25\%$), the model defaults to conservative bounds to prevent optimistic misrouting into hazards.
3. **Mandatory Human Sign-Off:** The model never issues dispatch orders. All plans generated from model passabilities must be reviewed and signed off with written justification by an authorized Incident Lead Approver.
