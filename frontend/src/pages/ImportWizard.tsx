import React, { useState } from 'react';
import { ValidationTable, QuarantinedItem } from '../components/ValidationTable';
import { MapPreview } from '../components/MapPreview';
import { RoadEdgeStyle } from '../map/RoadLayer';

export const ImportWizard: React.FC = () => {
  const [step, setStep] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [snapshotHash, setSnapshotHash] = useState<string | null>(null);

  const mockEdges: RoadEdgeStyle[] = [
    {
      edge_id: 'EDGE-WAYANAD-NH766-01',
      road_class: 'primary',
      length_m: 3400,
      free_flow_sec: 240,
      passability_prob: 0.88,
      bridge: false,
    },
    {
      edge_id: 'EDGE-WAYANAD-SH54-04',
      road_class: 'secondary',
      length_m: 2100,
      free_flow_sec: 180,
      passability_prob: 0.62,
      bridge: true,
    },
    {
      edge_id: 'EDGE-MEPPADI-ACC-01',
      road_class: 'tertiary',
      length_m: 1250,
      free_flow_sec: 140,
      passability_prob: 0.35,
      bridge: false,
    },
  ];

  const mockQuarantine: QuarantinedItem[] = [
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
  ];

  const handleSealSnapshot = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setSnapshotHash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
      setIsProcessing(false);
      setStep(3);
    }, 600);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 font-sans">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Regional Data Ingestion Wizard</h1>
        <p className="text-sm text-slate-500">
          Upload and validate road networks, facilities, and hazard overlays into an immutable, content-addressed snapshot.
        </p>
      </header>

      {/* Step Indicator */}
      <div className="flex space-x-4 border-b pb-3 text-xs font-semibold">
        <button
          onClick={() => setStep(1)}
          className={`pb-1 ${step === 1 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}
        >
          1. Upload &amp; Schema Validation
        </button>
        <button
          onClick={() => setStep(2)}
          className={`pb-1 ${step === 2 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}
        >
          2. Spatial Preview &amp; Quarantine
        </button>
        <button
          onClick={() => setStep(3)}
          className={`pb-1 ${step === 3 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}
        >
          3. Snapshot Sealing
        </button>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="p-8 border-2 border-dashed border-slate-300 rounded-lg text-center bg-slate-50">
            <div className="text-sm font-semibold text-slate-700">Drop regional CSV or GeoJSON files here</div>
            <p className="text-xs text-slate-500 mt-1">Supports OpenStreetMap road extracts, hazard rasters, and facility inventories.</p>
            <button
              onClick={() => setStep(2)}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded"
            >
              Simulate Ingestion of Kerala Dataset
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <ValidationTable
            totalRows={148}
            validRows={147}
            quarantinedRows={1}
            quarantineRecords={mockQuarantine}
          />
          <MapPreview
            regionName="Wayanad Disaster Corridor, Kerala"
            bbox={[75.9, 11.45, 76.4, 11.95]}
            edges={mockEdges}
          />
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 border rounded text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={handleSealSnapshot}
              disabled={isProcessing}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded shadow-xs"
            >
              {isProcessing ? 'Hashing & Sealing...' : 'Seal Content-Addressed Snapshot (SHA-256)'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-lg space-y-4">
          <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
            <span>✓ Snapshot Successfully Sealed and Registered</span>
          </div>
          <div className="text-xs text-slate-700 space-y-1">
            <div>
              <span className="font-semibold text-slate-900">Snapshot ID (SHA-256): </span>
              <code className="font-mono bg-white px-2 py-0.5 border rounded text-slate-800">{snapshotHash}</code>
            </div>
            <div>
              <span className="font-semibold text-slate-900">Region: </span>
              <span>Wayanad-Periyar Relief Corridor (India)</span>
            </div>
            <div>
              <span className="font-semibold text-slate-900">Network Topology: </span>
              <span>147 validated directed links sealed into graph version 1.0</span>
            </div>
          </div>
          <button
            onClick={() => setStep(1)}
            className="px-3 py-1.5 bg-slate-800 text-white text-xs rounded hover:bg-slate-900"
          >
            Start New Import
          </button>
        </div>
      )}
    </div>
  );
};
