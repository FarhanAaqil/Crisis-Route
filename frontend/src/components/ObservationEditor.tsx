import React, { useState } from 'react';

export interface ObservationFormData {
  edge_id: string;
  status: 'passable' | 'impassable' | 'partially_blocked' | 'debris_cleared';
  source_type: 'field_patrol' | 'drone_recon' | 'satellite_radar' | 'citizen_report';
  source_credibility: number;
  water_depth_cm: number;
  notes: string;
}

interface ObservationEditorProps {
  edgeId: string;
  initialStatus?: 'passable' | 'impassable' | 'partially_blocked' | 'debris_cleared';
  onSubmit: (data: ObservationFormData) => void;
  onCancel?: () => void;
}

export const ObservationEditor: React.FC<ObservationEditorProps> = ({
  edgeId,
  initialStatus = 'partially_blocked',
  onSubmit,
  onCancel,
}) => {
  const [status, setStatus] = useState(initialStatus);
  const [sourceType, setSourceType] = useState<ObservationFormData['source_type']>('field_patrol');
  const [credibility, setCredibility] = useState<number>(0.85);
  const [waterDepth, setWaterDepth] = useState<number>(15.0);
  const [notes, setNotes] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      edge_id: edgeId,
      status,
      source_type: sourceType,
      source_credibility: credibility,
      water_depth_cm: waterDepth,
      notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border rounded-lg space-y-4 text-xs font-sans shadow-xs">
      <div className="flex justify-between items-center border-b pb-2">
        <h4 className="font-bold text-slate-800 text-sm">Submit Field Road Observation</h4>
        <code className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">{edgeId}</code>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-600 font-medium mb-1">Observed Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ObservationFormData['status'])}
            className="w-full border rounded px-2 py-1.5 bg-white"
          >
            <option value="passable">Passable (Usable)</option>
            <option value="impassable">Impassable (Blocked / Submerged)</option>
            <option value="partially_blocked">Partially Blocked (Single Lane)</option>
            <option value="debris_cleared">Debris Cleared (Restored)</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">Source Type</label>
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as ObservationFormData['source_type'])}
            className="w-full border rounded px-2 py-1.5 bg-white"
          >
            <option value="field_patrol">Disaster Field Patrol</option>
            <option value="drone_recon">UAV / Drone Recon</option>
            <option value="satellite_radar">Satellite Synthetic Aperture Radar</option>
            <option value="citizen_report">Citizen / Crowdsource Report</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-slate-600 font-medium mb-1">
            Source Credibility Weight ({credibility.toFixed(2)})
          </label>
          <input
            type="range"
            min="0.30"
            max="1.00"
            step="0.05"
            value={credibility}
            onChange={(e) => setCredibility(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-slate-600 font-medium mb-1">Standing Water Depth (cm)</label>
          <input
            type="number"
            min="0"
            max="250"
            value={waterDepth}
            onChange={(e) => setWaterDepth(parseFloat(e.target.value) || 0)}
            className="w-full border rounded px-2 py-1"
          />
        </div>
      </div>

      <div>
        <label className="block text-slate-600 font-medium mb-1">Field Verification Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Culvert damage reported 50m north of junction; 4WD trucks only."
          className="w-full border rounded p-2 h-16"
        />
      </div>

      <div className="flex justify-end space-x-2 pt-2 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 border rounded text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded"
        >
          Publish &amp; Advance Graph Version
        </button>
      </div>
    </form>
  );
};
