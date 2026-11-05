import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ThreeTacticalRadar } from '../src/components/ThreeTacticalRadar';
import { ThreeCorridorVisualizer } from '../src/components/ThreeCorridorVisualizer';

describe('Three.js 3D Tactical Visualizer Components', () => {
  it('renders ThreeTacticalRadar without throwing in server/headless environment', () => {
    const html = renderToString(
      React.createElement(ThreeTacticalRadar, { size: 120, activeRegion: 'Kerala' })
    );
    expect(html).toBeDefined();
  });

  it('renders ThreeCorridorVisualizer with node and corridor stats', () => {
    const html = renderToString(
      React.createElement(ThreeCorridorVisualizer, {
        edges: [
          {
            edge_id: 'E1',
            u_node: 'N1',
            v_node: 'N2',
            u_coord: [76.1, 11.6],
            v_coord: [76.2, 11.7],
            road_class: 'primary',
            bridge: true,
            length_m: 2400,
            free_flow_sec: 180,
            passability_prob: 0.85,
            credible_interval: [0.75, 0.92],
            stale_age_hours: 1.2,
            risk_class: 'PASSABLE',
          },
        ],
        nodes: [
          {
            node_id: 'N1',
            name: 'Depot A',
            node_type: 'depot',
            coordinates: [76.1, 11.6],
          },
          {
            node_id: 'N2',
            name: 'Camp B',
            node_type: 'demand',
            coordinates: [76.2, 11.7],
          },
        ],
        regionName: 'Wayanad Corridor',
      })
    );
    expect(html).toBeDefined();
    // Verify fallback content or tactical container rendered
    expect(html).toContain('Tactical');
  });
});
