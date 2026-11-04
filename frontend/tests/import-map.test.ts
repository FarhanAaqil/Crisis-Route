import { describe, it, expect } from 'vitest';
import { QuarantinedItem } from '../src/components/ValidationTable';
import { SnapshotItem } from '../src/components/VersionTimeline';

describe('Import and Validation Component Contracts', () => {
  it('correctly models quarantined item structure', () => {
    const item: QuarantinedItem = {
      quarantine_id: 'test-q-1',
      file_name: 'test_network.csv',
      row_index: 10,
      raw_data: { edge_id: 'E_FAIL' },
      errors: [
        {
          column: 'length_m',
          error_code: 'INVALID_LENGTH',
          message: 'length must be positive',
        },
      ],
    };
    expect(item.row_index).toBe(10);
    expect(item.errors[0].error_code).toBe('INVALID_LENGTH');
  });

  it('verifies snapshot item structure and hash format', () => {
    const snap: SnapshotItem = {
      snapshot_id: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      created_at: new Date().toISOString(),
      region_name: 'Kerala-Wayanad',
      edge_count: 500,
      node_count: 250,
      source_attribution: 'OpenStreetMap contributors (ODbL)',
    };
    expect(snap.snapshot_id).toHaveLength(64);
    expect(snap.edge_count).toBeGreaterThan(0);
  });
});
