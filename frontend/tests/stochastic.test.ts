import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScenarioFan } from '../src/components/ScenarioFan';
import { VoiMapOverlay } from '../src/components/VoiMapOverlay';

describe('Phase 5 Frontend Stochastic Fan and VoI Overlay Components', () => {
  it('renders Monte Carlo uncertainty fan with 5th, mean, and 95th percentiles', () => {
    const html = renderToStaticMarkup(
      React.createElement(ScenarioFan, {
        numSamples: 50,
        meanPassability: 0.82,
        worstCaseP05: 0.54,
        bestCaseP95: 0.96,
        samplingDurationMs: 145,
        sampleSurvivalRates: [0.55, 0.70, 0.82, 0.90, 0.95],
      })
    );

    expect(html).toContain('Monte Carlo Uncertainty Fan (S=50)');
    expect(html).toContain('82%');
    expect(html).toContain('54%');
    expect(html).toContain('96%');
    expect(html).toContain('145ms');
  });

  it('renders VoI reconnaissance overlay with ranked target cards', () => {
    const targets = [
      {
        edge_id: 'WAYANAD-NH766-CUT',
        expected_regret_reduction: 18.2,
        inspection_cost: 12.0,
        voi_score: 1.517,
        priority_rank: 1,
      },
      {
        edge_id: 'MEPPADI-SH54-BYPASS',
        expected_regret_reduction: 9.4,
        inspection_cost: 10.0,
        voi_score: 0.940,
        priority_rank: 2,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(VoiMapOverlay, {
        targets,
        selectedEdgeId: 'WAYANAD-NH766-CUT',
        onSelectTarget: () => {},
      })
    );

    expect(html).toContain('Reconnaissance Priority Overlay');
    expect(html).toContain('WAYANAD-NH766-CUT');
    expect(html).toContain('1.517');
    expect(html).toContain('#1');
    expect(html).toContain('MEPPADI-SH54-BYPASS');
    expect(html).toContain('#2');
  });
});

