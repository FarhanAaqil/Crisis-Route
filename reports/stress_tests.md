# Adversarial Stress-Testing and Failure Mode Analysis

Evaluation of system boundaries, IIS diagnostics, and graceful degradation across 5 stress scenarios:

| ID | Scenario | Adversarial Condition | Diagnosed Failure Mode | Graceful Degradation |
| :--- | :--- | :--- | :--- | :---: |
| `ST-1` | **Extreme Network Severance** | 80% of primary and secondary road corridors severed by landslides | `PHYSICAL_NETWORK_DISCONNECTION` | 🛡️ VERIFIED |
| `ST-2` | **Severe Commodity Stock Depletion** | Total relief demand exceeds depot inventories by > 300% | `GLOBAL_INVENTORY_EXHAUSTION` | 🛡️ VERIFIED |
| `ST-3` | **Acute Transport Fleet Bottleneck** | Single small 350kg vehicle tasked with multi-ton corridor demand | `FLEET_PAYLOAD_CAPACITY_EXHAUSTION` | 🛡️ VERIFIED |
| `ST-4` | **Observation Staleness & Sensor Conflict** | Contradictory status reports on critical bridge with stale evidence | `EPISTEMIC_OBSERVATION_CONFLICT` | 🛡️ VERIFIED |
| `ST-5` | **Extreme Demographic Vulnerability Skew** | 100% of demand clusters are vulnerable clinics with strict alpha=0.60 service floor | `EQUITY_FLOOR_SATISFACTION` | 🛡️ VERIFIED |

## Failure Mode Insights

- **ST-1 (Network Severance):** System does not crash when disconnected; computes IIS explanations identifying isolated nodes.
- **ST-2 (Stock Depletion):** Prevents impossible commitments; identifies exact unit deficits per commodity.
- **ST-3 (Fleet Bottleneck):** Detects payload weight shortfalls and computes realistic multi-trip bounds.
- **ST-4 (Staleness/Conflict):** ObservationGraphManager dynamically detects conflicting reports and widens confidence intervals.
- **ST-5 (Vulnerability Skew):** Strict service floors (alpha=0.60) are enforced mathematically in CP-SAT.
