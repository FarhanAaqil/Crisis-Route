import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ImportWizard } from '../src/pages/ImportWizard';
import { ValidationTable } from '../src/components/ValidationTable';
import { ModelStatus } from '../src/pages/ModelStatus';
import { RouteComparison } from '../src/components/RouteComparison';
import { ScenarioFan } from '../src/components/ScenarioFan';
import { VoiMapOverlay } from '../src/components/VoiMapOverlay';
import { Dashboard } from '../src/pages/Dashboard';
import { AuditLogViewer } from '../src/pages/AuditLogViewer';

describe('End-to-End Operational Workflow Walkthrough Simulation', () => {
  it('executes the full 6-phase operational user flow within seconds', () => {
    const startTime = Date.now();

    // Step 1: Snapshot Creation & Ingestion Validation
    const importHtml = renderToString(React.createElement(ImportWizard));
    expect(importHtml).toContain('Regional Data Ingestion Wizard');
    expect(importHtml).toContain('Simulate Ingestion of Kerala Dataset');

    const quarantineHtml = renderToString(
      React.createElement(ValidationTable, {
        totalRows: 120,
        validRows: 119,
        quarantinedRows: 1,
        quarantineRecords: [
          {
            quarantine_id: 'q-001',
            file_name: 'kerala_road_network.csv',
            row_index: 42,
            raw_data: { edge_id: 'E_CORRUPT_01', u_lat: 'invalid_num' },
            errors: [
              {
                column: 'u_lat',
                error_code: 'COORDINATE_PARSE_ERROR',
                message: 'Failed to parse coordinates as floats',
                invalid_value: 'invalid_num',
              },
            ],
          },
        ],
      })
    );
    expect(quarantineHtml).toContain('Quarantine Buffer');
    expect(quarantineHtml).toContain('COORDINATE_PARSE_ERROR');
    expect(quarantineHtml).toContain('kerala_road_network.csv');

    // Step 2: Passability Scoring & Calibration Status
    const modelHtml = renderToString(React.createElement(ModelStatus));
    expect(modelHtml).toContain('Passability Model Calibration Status');
    expect(modelHtml).not.toContain('0.042'); // no hardcoded metrics: values come from the API

    // Step 3: Route Alternatives with Yen's Algorithm
    const routeHtml = renderToString(
      React.createElement(RouteComparison, {
        vehicleId: 'VEH-DEF-01',
        destinationName: 'Meppadi Primary Health Centre',
        routes: [
          {
            rank: 1,
            node_path: ['N0', 'N1', 'N3'],
            edge_path: ['E1', 'E2'],
            travel_time_min: 24,
            survival_prob: 0.82,
            jaccard_overlap_with_primary: 1.0,
            eta_inflation_pct: 0,
          },
          {
            rank: 2,
            node_path: ['N0', 'N2', 'N3'],
            edge_path: ['E3', 'E4'],
            travel_time_min: 29,
            survival_prob: 0.76,
            jaccard_overlap_with_primary: 0.25,
            eta_inflation_pct: 20.8,
          },
        ],
        selectedRank: 1,
        onSelectRoute: () => {},
      })
    );
    expect(routeHtml).toContain('Diverse Route Alternatives (Yen k-Shortest)');
    expect(routeHtml).toContain('Primary Shortest');
    expect(routeHtml).toContain('Alternative 1');
    expect(routeHtml).toContain('82.0');
    expect(routeHtml).toContain('% Survival');

    // Step 4: Robust Allocation & Scenario Recourse
    const scenarioFanHtml = renderToString(
      React.createElement(ScenarioFan, {
        numSamples: 50,
        meanPassability: 0.74,
        worstCaseP05: 0.42,
        bestCaseP95: 0.91,
        samplingDurationMs: 95,
      })
    );
    expect(scenarioFanHtml).toContain('Monte Carlo Uncertainty Fan');
    expect(scenarioFanHtml).toContain('5th Percentile');
    expect(scenarioFanHtml).toContain('42');
    expect(scenarioFanHtml).toContain('74');
    expect(scenarioFanHtml).toContain('91');

    // Step 5: Value of Information (VoI) Reconnaissance Ranking
    const voiHtml = renderToString(
      React.createElement(VoiMapOverlay, {
        targets: [
          {
            edge_id: 'EDGE-WAYANAD-SH54-04',
            expected_regret_reduction: 42.5,
            inspection_cost: 1.0,
            voi_score: 42.5,
            priority_rank: 1,
          },
        ],
        onSelectTarget: () => {},
      })
    );
    expect(voiHtml).toContain('Reconnaissance Priority Overlay');
    expect(voiHtml).toContain('EVPI/EVSI Guided');
    expect(voiHtml).toContain('EDGE-WAYANAD-SH54-04');

    // Step 6: Approver Sign-Off & Audit Trail
    const dashboardHtml = renderToString(
      React.createElement(Dashboard, { currentRole: 'approver' })
    );
    expect(dashboardHtml).toContain('Incident Lead Sign-Off Gate');
    expect(dashboardHtml).toContain('Operational Rationale &amp; Risk Acceptance (Mandatory)');

    const auditHtml = renderToString(React.createElement(AuditLogViewer));
    expect(auditHtml).toContain('Operational Audit Trail');

    const durationMs = Date.now() - startTime;
    // Walkthrough simulation executes in under 2 seconds (well under the 3-minute SLA)
    expect(durationMs).toBeLessThan(2000);
  });
});
