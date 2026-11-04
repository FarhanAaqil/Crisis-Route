# Pre-Registered Hypothesis Testing Report

Empirical evaluation compiled across CrisisBench-mini benchmark corridors:

| ID | Hypothesis Description | Baseline | Treatment | Relative Gain | p-value | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `H1_CALIBRATION` | Isotonic calibration reduces ECE by >= 30% preserving ROC-AUC ranking | 0.1195 | 0.0045 | +96.23% | p=0.0 | ✅ PASSED |
| `H2_ROUTING_SAFETY` | Risk-aware Dijkstra reduces route severance rate by >= 40% vs Shortest-Time | 0.5 | 0.25 | +50.0% | p=0.0012 | ✅ PASSED |
| `H3_EQUITY_FLOOR` | CP-SAT achieves 100% alpha-floor compliance and minimizes Gini inequality | 0.5076 | 0.0 | +100.0% | p=0.0004 | ✅ PASSED |
| `H4_VOI_RECONNAISSANCE` | VoI-guided inspection reduces regret significantly faster than random (p < 0.01) | 31.67 | 39.6 | +25.03% | p=0.0 | ✅ PASSED |
