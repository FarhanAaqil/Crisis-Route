import { describe, it, expect } from 'vitest';
import { RouteOption } from '../src/components/RouteComparison';
import { ModelMetricsSummary } from '../src/pages/ModelStatus';

describe('Intelligence Layer & Routing Contracts', () => {
  it('validates Yen k-shortest route option calculations', () => {
    const route: RouteOption = {
      rank: 1,
      node_path: ['N1', 'N2', 'N3'],
      edge_path: ['E1', 'E2'],
      travel_time_min: 25.4,
      survival_prob: 0.885,
      jaccard_overlap_with_primary: 1.0,
      eta_inflation_pct: 0.0,
    };

    expect(route.rank).toBe(1);
    expect(route.survival_prob).toBeGreaterThan(0.0);
    expect(route.survival_prob).toBeLessThanOrEqual(1.0);
    expect(route.jaccard_overlap_with_primary).toBe(1.0);
  });

  it('validates calibration metrics summary format', () => {
    const summary: ModelMetricsSummary = {
      model_version: 'v1.0.0-gbdt-isotonic',
      model_type: 'GBDT_Isotonic',
      brier_score: 0.088,
      expected_calibration_error: 0.042,
      roc_auc: 0.865,
      total_samples: 1600,
      reliability_diagram: [],
    };

    expect(summary.brier_score).toBeLessThan(0.10);
    expect(summary.expected_calibration_error).toBeLessThan(0.05);
    expect(summary.roc_auc).toBeGreaterThan(0.80);
  });
});
