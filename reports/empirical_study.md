# Hypothesis Evaluation Report

Exploratory evaluation on the synthetic CrisisBench-mini generator and three seeded corridors. Statistical tests are computed from the data (no constants); see each outcome's `details` in `hypothesis_results.json` for the method.

| ID | Hypothesis Description | Baseline | Treatment | Relative Gain | p-value | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `H1_CALIBRATION` | Isotonic calibration reduces held-out ECE by >= 30% preserving ROC-AUC | 0.1421 | 0.0591 | +58.41% | p=0.000999 | ✅ PASSED |
| `H2_ROUTING_SAFETY` | Risk-aware Dijkstra reduces route severance rate by >= 40% vs Shortest-Time | 0.4434 | 0.2378 | +46.37% | p=8.361089130433666e-199 | ✅ PASSED |
| `H3_EQUITY_FLOOR` | CP-SAT achieves 100% alpha-floor compliance and lowers Gini vs greedy | 0.5968 | 0.0102 | +98.3% | p=9.313225746154785e-10 | ✅ PASSED |
| `H4_VOI_RECONNAISSANCE` | EVPI-guided inspection saves more simulated minutes than random (p < 0.01) | 6.44 | 20.15 | +212.89% | p=5e-05 | ✅ PASSED |
