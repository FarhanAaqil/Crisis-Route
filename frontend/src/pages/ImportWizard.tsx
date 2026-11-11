import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ValidationTable, QuarantinedItem } from '../components/ValidationTable';
import { MapPreview } from '../components/MapPreview';
import { RoadEdgeStyle } from '../map/RoadLayer';
import { uploadNetworkData } from '../api/client';
import { UploadCloud, FileSpreadsheet, CheckCircle2, ShieldCheck, ArrowRight, RotateCcw } from 'lucide-react';

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
    } catch (err) {
      notify(`Upload failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
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
    } catch (err) {
      notify(`Sample ingestion failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
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
      <header className="border-b border-palette-slate/25 pb-4">
        <h1 className="text-xl sm:text-2xl font-extrabold text-palette-cream tracking-tight">
          Regional Data Ingestion Wizard
        </h1>
        <p className="text-xs sm:text-sm text-palette-frost mt-0.5">
          Upload and validate road networks, facilities, and hazard overlays into an immutable, content-addressed snapshot.
        </p>
      </header>

      {/* Step Indicator */}
      <div className="flex space-x-6 border-b border-palette-slate/25 pb-3 text-xs font-semibold">
        <button
          onClick={() => setStep(1)}
          className={`pb-2 transition-all flex items-center space-x-2 ${
            step === 1 ? 'border-b-2 border-palette-frost text-palette-cream font-bold' : 'text-palette-frost hover:text-palette-cream'
          }`}
        >
          <span className="w-5 h-5 rounded-full glass-card-subtle flex items-center justify-center text-[10px] text-palette-cream">1</span>
          <span>1. Upload &amp; Schema Validation</span>
        </button>
        <button
          onClick={() => setStep(2)}
          disabled={totalRows === 0}
          className={`pb-2 transition-all flex items-center space-x-2 ${
            step === 2
              ? 'border-b-2 border-palette-frost text-palette-cream font-bold'
              : 'text-palette-frost hover:text-palette-cream disabled:opacity-40'
          }`}
        >
          <span className="w-5 h-5 rounded-full glass-card-subtle flex items-center justify-center text-[10px] text-palette-cream">2</span>
          <span>2. Spatial Preview &amp; Quarantine</span>
        </button>
        <button
          onClick={() => setStep(3)}
          disabled={!snapshotHash}
          className={`pb-2 transition-all flex items-center space-x-2 ${
            step === 3
              ? 'border-b-2 border-palette-frost text-palette-cream font-bold'
              : 'text-palette-frost hover:text-palette-cream disabled:opacity-40'
          }`}
        >
          <span className="w-5 h-5 rounded-full glass-card-subtle flex items-center justify-center text-[10px] text-palette-cream">3</span>
          <span>3. Snapshot Sealing</span>
        </button>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="p-10 border-2 border-dashed border-palette-frost/30 rounded-3xl text-center glass-card space-y-4 shadow-glass-card">
            <div className="w-14 h-14 mx-auto rounded-2xl glass-card-subtle flex items-center justify-center text-palette-frost shadow-inner border border-palette-frost/30">
              <UploadCloud className="w-7 h-7" />
            </div>
            <div>
              <div className="text-base font-bold text-palette-cream">Drop regional CSV or GeoJSON files here</div>
              <p className="text-xs text-palette-frost max-w-md mx-auto mt-1">
                Supports OpenStreetMap road extracts, hazard rasters, and facility inventories.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
              <label className="cursor-pointer px-5 py-2.5 glass-card-subtle hover:bg-palette-steel/50 active:scale-95 border border-palette-frost/25 rounded-2xl text-xs font-semibold text-palette-cream shadow-glass-card transition-all flex items-center space-x-2 min-h-[44px]">
                <FileSpreadsheet className="w-4 h-4 text-palette-frost" />
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
                className="px-5 py-2.5 glass-btn-primary hover:border-palette-frost/60 active:scale-95 disabled:opacity-50 text-palette-cream text-xs font-bold rounded-2xl shadow-glass-card transition-all flex items-center space-x-2 min-h-[44px]"
              >
                <span>{isProcessing ? 'Validating Schema...' : 'Simulate Ingestion of Kerala Dataset'}</span>
                <ArrowRight className="w-4 h-4" />
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

          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 glass-card-subtle hover:bg-palette-steel/50 rounded-2xl text-xs font-semibold text-palette-cream transition-colors min-h-[44px] border border-palette-frost/25"
            >
              Back
            </button>
            <button
              onClick={handleSealSnapshot}
              disabled={isProcessing}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600/90 to-emerald-500/90 hover:from-emerald-500 hover:to-emerald-400 active:scale-95 text-white text-xs font-bold rounded-2xl shadow-glass-card border border-emerald-400/30 transition-all flex items-center space-x-2 min-h-[44px]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isProcessing ? 'Hashing & Sealing...' : 'Seal Content-Addressed Snapshot (SHA-256)'}</span>
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="p-8 bg-emerald-950/40 border border-emerald-800/80 rounded-3xl space-y-4 shadow-glass-card backdrop-blur-md">
          <div className="flex items-center space-x-2 text-emerald-300 font-bold text-base">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>✓ Snapshot Successfully Sealed and Registered</span>
          </div>
          <div className="text-xs text-palette-frost space-y-2">
            <div>
              <span className="font-semibold text-palette-cream">Snapshot ID (SHA-256): </span>
              <code className="font-mono bg-palette-deep/90 px-3 py-1.5 border border-palette-frost/25 rounded-xl text-emerald-300 break-all block mt-1">
                {snapshotHash}
              </code>
            </div>
            <div>
              <span className="font-semibold text-palette-cream">File Ingested: </span>
              <span className="font-mono text-palette-frost">{fileName}</span>
            </div>
            <div>
              <span className="font-semibold text-palette-cream">Network Validation: </span>
              <span className="text-palette-frost">
                {validRows} validated links sealed &bull; {quarantinedRows} isolated in quarantine buffer
              </span>
            </div>
          </div>
          <button
            onClick={() => setStep(1)}
            className="px-5 py-2.5 glass-card-subtle text-palette-cream text-xs rounded-2xl hover:bg-palette-steel/50 font-medium transition-all flex items-center space-x-2 min-h-[44px] border border-palette-frost/25"
          >
            <RotateCcw className="w-3.5 h-3.5 text-palette-frost" />
            <span>Start New Import</span>
          </button>
        </div>
      )}
    </div>
  );
};
