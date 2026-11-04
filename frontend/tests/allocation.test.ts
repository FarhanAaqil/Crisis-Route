import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CriticalEdges } from '../src/components/CriticalEdges';
import { AllocationTable } from '../src/components/AllocationTable';
import { EquityMetrics } from '../src/components/EquityMetrics';
import { SolverDiagnostics } from '../src/components/SolverDiagnostics';

describe('Phase 4 Frontend Operational Allocation Panels', () => {
  it('renders critical edges and VOI recommendations table', () => {
    const recommendations = [
      {
        edge_id: 'EDGE-WAYANAD-NH766-01',
        expected_regret_reduction: 14.5,
        inspection_cost: 10.0,
        voi_score: 0.852,
        priority_rank: 1,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(CriticalEdges, { recommendations })
    );

    expect(html).toContain('EDGE-WAYANAD-NH766-01');
    expect(html).toContain('0.852');
    expect(html).toContain('#1');
  });

  it('renders allocation and unmet demand table with status badges', () => {
    const allocations = [
      {
        demand_node_id: 'NODE-MEPPADI-ISOLATED',
        commodity_id: 'COM-WATER-10L',
        vehicle_id: 'VEH-KSRTC-01',
        quantity_delivered: 200,
      },
    ];
    const unmet = [
      {
        demand_node_id: 'NODE-CHOORALMALA',
        commodity_id: 'COM-WATER-10L',
        unmet_quantity: 50,
        vulnerable_group: 'tea_plantation_workers',
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(AllocationTable, {
        allocations,
        unmetDemands: unmet,
      })
    );

    expect(html).toContain('NODE-MEPPADI-ISOLATED');
    expect(html).toContain('200');
    expect(html).toContain('Delivered');
    expect(html).toContain('-50');
    expect(html).toContain('Deficit');
  });

  it('renders equity metrics and alpha-floor compliance badge', () => {
    const equity = {
      total_deprivation_penalty: 145.2,
      mean_fulfillment_ratio: 0.88,
      min_fulfillment_ratio: 0.50,
      vulnerable_group_fulfillment_ratio: 0.75,
      alpha_service_floor: 0.40,
      alpha_floor_satisfied: true,
      gini_coefficient: 0.12,
      unmet_demand_count: 2,
    };

    const html = renderToStaticMarkup(
      React.createElement(EquityMetrics, { equity })
    );

    expect(html).toContain('α-Floor Satisfied');
    expect(html).toContain('0.120');
    expect(html).toContain('145.2');
  });

  it('renders solver diagnostics and infeasibility explanation box', () => {
    const diagnostic = {
      status: 'INFEASIBLE',
      primary_cause: 'Demand for commodity COM-WATER-10L exceeds total stock by 200 units.',
      detail: 'Global deficit in potable water stock',
      explanations: ['Demand exceeds stock across all depots.'],
      remediation_suggestions: ['Increase inventory by at least 200 units.'],
      isolated_demand_nodes: ['NODE-ISOLATED-01'],
      commodity_deficits: { 'COM-WATER-10L': 200 },
      capacity_deficit_kg: 0.0,
    };

    const html = renderToStaticMarkup(
      React.createElement(SolverDiagnostics, {
        solverStatus: 'INFEASIBLE',
        solveTimeSeconds: 0.12,
        snapshotId: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        infeasibilityDiagnostic: diagnostic,
      })
    );

    expect(html).toContain('INFEASIBLE');
    expect(html).toContain('Minimal Infeasible Subsystem');
    expect(html).toContain('COM-WATER-10L: -200 units');
    expect(html).toContain('NODE-ISOLATED-01');
    expect(html).toContain('Increase inventory by at least 200 units.');
  });
});
