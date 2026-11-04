# CrisisRoute — Research Pre-Registration Document

*Pre-Registered Hypotheses, Protocol, Statistical Power, and Geographic Benchmarks*  
**Date of Pre-Registration:** 2026-11-04  
**Principal Investigator & Author:** Farhan Aaqil (`fadurrani543@gmail.com`)  
**Status:** Frozen prior to test split evaluation

---

## 1. Study Regions (Indian Humanitarian Corridors)

To ensure operational realism across diverse topography and hydrological regimes, three flood- and hazard-prone Indian regions are pinned for the CrisisBench-mini benchmark:

### 1.1 Primary Benchmark Region: Kerala Disaster Basin (Wayanad & Periyar Basin)
- **Topography:** Complex highland terrain prone to monsoon-induced debris flows, landslides, and valley isolation (Wayanad) combined with downstream riverine flooding (Periyar / Ernakulam).
- **Bounding Box (EPSG:4326):**
  - **Wayanad Sector:** `[75.9000, 11.4500, 76.4000, 11.9500]`
  - **Periyar / Ernakulam Sector:** `[76.1500, 9.8500, 76.5000, 10.2500]`
- **Target Road Network:** $\le 50,000$ directed edges extracted from OpenStreetMap (ODbL).
- **Hazard Modalities:** Extreme monsoon rainfall (IMD gridded data / synthetic rainfields), river stage surges, and slope instability cutoffs.

### 1.2 Secondary Evaluation Regions
1. **Assam Flood Basin (Barak Valley / Silchar):**
   - **Bounding Box:** `[92.6500, 24.7000, 93.0500, 25.0500]`
   - **Characteristics:** Severe repetitive inundation, low-lying alluvial plains, bridge washouts, and extensive embankment breaches.
2. **Odisha Coastal Cyclone Corridor (Mahanadi Delta / Puri):**
   - **Bounding Box:** `[85.7000, 19.7500, 86.1500, 20.1500]`
   - **Characteristics:** Coastal storm surges, saline flooding, and cyclone windthrow blockages.

---

## 2. Pre-Registered Hypotheses & Numeric Thresholds

All evaluation metrics are computed on the frozen test split across 3 fixed random seeds ($S_{\text{seed}} = \{42, 137, 2026\}$) with paired-bootstrap 95% confidence intervals resampling across disaster events and scenario instances.

| ID | Hypothesis Statement | Mathematical Definition | Quantitative Pass Threshold |
|---|---|---|---|
| **H1** | Boosted trees with post-hoc isotonic calibration outperform the road-class frequency baseline on probabilistic accuracy. | $\Delta \text{Brier} = \text{Brier}_{\text{baseline}} - \text{Brier}_{\text{GBDT+Iso}}$ where $\text{Brier} = \frac{1}{|E|} \sum_{e} (p_e - z_e)^2$ | $\Delta \text{Brier} > 0.020$ with paired 95% bootstrap CI strictly excluding zero. |
| **H2 (Core)** | Holding ranking discrimination (ROC-AUC) invariant, downstream decision regret increases monotonically as Expected Calibration Error (ECE) increases. | Spearman rank correlation $\rho\left(\text{ECE}(T), \overline{\text{Regret}}(T)\right)$ across temperature sweep $T \in \{0.5, 0.67, 1.0, 1.5, 2.0\}$ where $p_e^{(T)} = \sigma(\operatorname{logit}(p_e)/T)$. | Spearman $\rho \ge 0.80$ with 95% bootstrap CI strictly excluding zero. |
| **H3** | Risk-aware routing using calibrated passabilities reduces blocked-edge travel exposure relative to shortest-travel-time routing. | $\text{Exposure} = \frac{\sum_{e \in R} d_e (1 - z_e)}{\sum_{e \in R} d_e}$ at matched travel budget. | $\ge 25.0\%$ relative reduction in blocked route exposure with $\le 20.0\%$ median ETA inflation. |
| **H4** | Robust equitable allocation raises service levels for the most vulnerable demand group compared to proportional greedy allocation. | $\text{Service}_g = \frac{\sum_{d \in g} \sum_k \text{Delivered}_{d,k}}{\sum_{d \in g} \sum_k \text{Demand}_{d,k}}$, $\min_g \text{Service}_g$ | Worst-group served fraction increases by $\ge 15.0\%$ absolute, with $\le 5.0\%$ reduction in aggregate served demand. |
| **H5** | Value-of-Information (VOI) ranked reconnaissance inspections yield faster cumulative regret reduction per unit cost than random or maximum-uncertainty selection. | Cumulative regret reduction per unit inspection cost: $\frac{\sum_{k=1}^K [\text{Regret}(k-1) - \text{Regret}(k)]}{\sum_{k=1}^K \kappa_{e_k}}$ for $K=5$ checks. | $\Delta \text{Efficiency} > 0$ versus random and entropy-based heuristics, with 95% bootstrap CI excluding zero. |

---

## 3. Controlled Miscalibration Protocol

To guarantee that any change in decision regret is caused solely by probability calibration rather than classification ranking:
1. Base probabilities $p_e \in (0, 1)$ are output by LightGBM with isotonic calibration.
2. A temperature parameter $T$ is applied to the log-odds:
   $$p_e^{(T)} = \sigma\left(\frac{\ln(p_e / (1 - p_e))}{T}\right) = \frac{1}{1 + \exp\left(-\frac{\operatorname{logit}(p_e)}{T}\right)}$$
3. Five temperature levels are evaluated:
   - $T = 0.50$ (Extremely overconfident)
   - $T = 0.67$ (Moderately overconfident)
   - $T = 1.00$ (Calibrated model)
   - $T = 1.50$ (Moderately underconfident)
   - $T = 2.00$ (Extremely underconfident)
4. Monotonicity Invariance: Because $f(x) = x/T$ is strictly monotonic for any $T > 0$, the relative ordering of all edge passabilities is identical. Thus, the Receiver Operating Characteristic Area Under the Curve (ROC-AUC) is mathematically constant.
5. Regret Calculation: For each $T$, the altered probabilities $p_e^{(T)}$ are fed into the identical routing, CP-SAT allocation, and VOI workflows. True regret is scored against the benchmark oracle $\pi^*(\mathbf{z}^*)$:
   $$\operatorname{Regret}(\pi^{(T)}) = L(\pi^{(T)}; \mathbf{z}^*) - L(\pi^*(\mathbf{z}^*); \mathbf{z}^*)$$

---

## 4. Benchmark Splitting & Leakage Safeguards

- **Total Scenario Instances:** 240 instances generated from 12 distinct hazard footprints (20 parameter perturbations per event).
- **Split Partitioning:**
  - **Train Split:** Events 1 through 8 (160 instances).
  - **Calibration / Validation Split:** Events 9 and 10 (40 instances).
  - **Test Split:** Events 11 and 12 (40 instances).
- **Strict Leakage Guard:** Splitting is performed exclusively at the **disaster event level**. No road edge state, hazard raster pixel, or observation report from Events 11 or 12 may appear in training or calibration sets.
- **Generator Parameters:** Ground-truth physical parameters (soil fragility constants, hazard intensity coefficients) are sealed in the generative benchmark module and isolated from all predictive model inputs.
