import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ValidationTable, QuarantinedItem } from '../components/ValidationTable';
import { MapPreview } from '../components/MapPreview';
import { RoadEdgeStyle } from '../map/RoadLayer';
import { uploadNetworkData } from '../api/client';

export const ImportWizard: React.FC = () => {
  const { notify } = useApp();
  const [step, setStep] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [snapshotHash, setSnapshotHash] = useState<string | null>(null);

  // Ingestion results
  const [fileName, setFileName] = useState<string>('kerala_monsoon_road_network.csv');
  const [totalRows, setTotalRows] = useState<number>(0);
  const [validRows, setValidRows] = useState<number>(0);
  const [quarantinedRows, setQuarantinedRows] = useState<number>(0);
  const [quarantineRecords, setQuarantineRecords] = useState<QuarantinedItem[]>([]);
  const [previewEdges, setPreviewEdges] = useState<RoadEdgeStyle[]>([]);

  const defaultSampleCSV = `edge_id,u_node,v_node,length_m,free_flow_sec,road_class,bridge,passability_prob
EDGE-WAYANAD-NH766-01,DEPOT-KALPETTA,JUNCTION-CENTRAL-HUB,3400.0,240.0,trunk,false,0.95
EDGE-WAYANAD-SH54-04,JUNCTION-CENTRAL-HUB,NODE-MEPPADI-ISOLATED,2100.0,180.0,primary,true,0.88
EDGE-MEPPADI-ACC-01,NODE-MEPPADI-ISOLATED,NODE-CHOORALMALA-SHELTER,1250.0,140.0,secondary,false,0.72
EDGE-MALFORMED-ROW,ERR_NODE_A,ERR_NODE_B,-500.0,-30.0,invalid_class,false,1.95`;

  const handleFileUpload = async (file: File) => {
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await uploadNetworkData(formData);
      setFileName(res.file_name);
      setSnapshotHash(res.snapshot_hash);
      setTotalRows(res.total_rows);
      setValidRows(res.valid_rows);
      setQuarantinedRows(res.quarantined_rows);
      setQuarantineRecords(res.quarantine_records);
      setPreviewEdges(res.valid_edges_preview);

      notify(`Processed ${res.total_rows} rows: ${res.valid_rows} valid, ${res.quarantined_rows} quarantined`, 'info');
      setStep(2);
    } catch (err: any) {
      notify(`Upload failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateSample = async () => {
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('raw_content', defaultSampleCSV);
      formData.append('file_name', 'kerala_wayanad_corridor.csv');

      const res = await uploadNetworkData(formData);
      setFileName(res.file_name);
      setSnapshotHash(res.snapshot_hash);
      setTotalRows(res.total_rows);
      setValidRows(res.valid_rows);
      setQuarantinedRows(res.quarantined_rows);
      setQuarantineRecords(res.quarantine_records);
      setPreviewEdges(res.valid_edges_preview);

      notify(`Ingested sample corridor: ${res.valid_rows} valid links parsed, ${res.quarantined_rows} quarantined`, 'info');
      setStep(2);
    } catch (err: any) {
      notify(`Sample ingestion failed: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSealSnapshot = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep(3);
      notify('Content-addressed snapshot sealed into ledger', 'success');
    }, 400);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 font-sans">
      <header className="border-b pb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Regional Data Ingestion Wizard</h1>
        <p className="text-xs sm:text-sm text-slate-500">
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
          disabled={totalRows === 0}
          className={`pb-1 ${step === 2 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 disabled:opacity-50'}`}
        >
          2. Spatial Preview &amp; Quarantine
        </button>
        <button
          onClick={() => setStep(3)}
          disabled={!snapshotHash}
          className={`pb-1 ${step === 3 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400 disabled:opacity-50'}`}
        >
          3. Snapshot Sealing
        </button>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="p-8 border-2 border-dashed border-slate-300 rounded-lg text-center bg-slate-50 space-y-3">
            <div className="text-sm font-semibold text-slate-700">Drop regional CSV or GeoJSON files here</div>
            <p className="text-xs text-slate-500">
              Supports OpenStreetMap road extracts, hazard rasters, and facility inventories.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <label className="cursor-pointer px-4 py-2 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-xs">
                <span>Select File from Disk</span>
                <input
                  type="file"
                  accept=".csv,.json,.geojson"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </label>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleSimulateSample}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded shadow-xs transition"
              >
                {isProcessing ? 'Validating Schema...' : 'Simulate Ingestion of Kerala Dataset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <ValidationTable
            totalRows={totalRows}
            validRows={validRows}
            quarantinedRows={quarantinedRows}
            quarantineRecords={quarantineRecords}
          />

          <MapPreview
            regionName={`Ingested Corridor: ${fileName}`}
            bbox={[75.9, 11.45, 76.4, 11.95]}
            edges={previewEdges}
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
              <code className="font-mono bg-white px-2 py-0.5 border rounded text-slate-800 break-all">
                {snapshotHash}
              </code>
            </div>
            <div>
              <span className="font-semibold text-slate-900">File Ingested: </span>
              <span>{fileName}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-900">Network Validation: </span>
              <span>
                {validRows} validated links sealed &bull; {quarantinedRows} isolated in quarantine buffer
              </span>
            </div>
          </div>
          <button
            onClick={() => setStep(1)}
            className="px-3 py-1.5 bg-slate-800 text-white text-xs rounded hover:bg-slate-900 font-medium"
          >
            Start New Import
          </button>
        </div>
      )}
    </div>
  );
};
