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
  disabled?: boolean;
}

export const ObservationEditor: React.FC<ObservationEditorProps> = ({
  edgeId,
  initialStatus = 'partially_blocked',
  onSubmit,
  onCancel,
  disabled = false,
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
    <form onSubmit={handleSubmit} className="p-5 glass-card-subtle rounded-2xl space-y-4 text-xs font-sans shadow-glass-card border border-palette-frost/25">
      <div className="flex justify-between items-center border-b border-palette-slate/25 pb-3">
        <h4 className="font-bold text-palette-cream text-sm">Submit Field Road Observation</h4>
        <code className="glass-card px-2.5 py-1 rounded-xl font-mono text-palette-frost text-xs border border-palette-frost/20">
          {edgeId}
        </code>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label htmlFor="obs-status" className="block text-palette-cream font-semibold mb-1.5">
            Observed Status
          </label>
          <select
            id="obs-status"
            aria-label="Observed road passability status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ObservationFormData['status'])}
            className="w-full glass-input rounded-xl px-3 py-2 text-palette-cream focus:outline-none focus:ring-2 focus:ring-palette-frost min-h-[44px]"
          >
            <option value="passable" className="bg-palette-deep">Passable (Usable)</option>
            <option value="impassable" className="bg-palette-deep">Impassable (Blocked / Submerged)</option>
            <option value="partially_blocked" className="bg-palette-deep">Partially Blocked (Single Lane)</option>
            <option value="debris_cleared" className="bg-palette-deep">Debris Cleared (Restored)</option>
          </select>
        </div>

        <div>
          <label htmlFor="obs-source" className="block text-palette-cream font-semibold mb-1.5">
            Source Type
          </label>
          <select
            id="obs-source"
            aria-label="Observation reporting source"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as ObservationFormData['source_type'])}
            className="w-full glass-input rounded-xl px-3 py-2 text-palette-cream focus:outline-none focus:ring-2 focus:ring-palette-frost min-h-[44px]"
          >
            <option value="field_patrol" className="bg-palette-deep">Disaster Field Patrol</option>
            <option value="drone_recon" className="bg-palette-deep">UAV / Drone Recon</option>
            <option value="satellite_radar" className="bg-palette-deep">Satellite Synthetic Aperture Radar</option>
            <option value="citizen_report" className="bg-palette-deep">Citizen / Crowdsource Report</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div>
          <label htmlFor="obs-credibility" className="block text-palette-cream font-semibold mb-1.5">
            Source Credibility Weight ({credibility.toFixed(2)})
          </label>
          <input
            id="obs-credibility"
            aria-label="Source credibility weight slider"
            type="range"
            min="0.30"
            max="1.00"
            step="0.05"
            value={credibility}
            onChange={(e) => setCredibility(parseFloat(e.target.value))}
            className="w-full accent-palette-frost focus:outline-none py-2"
          />
        </div>

        <div>
          <label htmlFor="obs-water-depth" className="block text-palette-cream font-semibold mb-1.5">
            Standing Water Depth (cm)
          </label>
          <input
            id="obs-water-depth"
            aria-label="Standing water depth in centimeters"
            type="number"
            min="0"
            max="250"
            value={waterDepth}
            onChange={(e) => setWaterDepth(parseFloat(e.target.value) || 0)}
            className="w-full glass-input rounded-xl px-3 py-2 text-palette-cream focus:outline-none focus:ring-2 focus:ring-palette-frost min-h-[44px]"
          >
          </input>
        </div>
      </div>

      <div>
        <label htmlFor="obs-notes" className="block text-palette-cream font-semibold mb-1.5">
          Field Verification Notes
        </label>
        <textarea
          id="obs-notes"
          aria-label="Field verification notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Culvert damage reported 50m north of junction; 4WD trucks only."
          className="w-full glass-input rounded-2xl p-3 h-20 text-palette-cream placeholder-palette-slate focus:outline-none focus:ring-2 focus:ring-palette-frost font-sans"
        />
      </div>

      <div className="flex justify-end space-x-2.5 pt-3 border-t border-palette-slate/25">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 glass-card-subtle hover:bg-palette-steel/40 border border-palette-frost/25 rounded-2xl text-palette-frost hover:text-palette-cream min-h-[44px] font-medium transition-all"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={disabled}
          className="disabled:opacity-50 px-6 py-2.5 glass-btn-primary hover:border-palette-frost/60 active:scale-95 text-palette-cream font-bold rounded-2xl shadow-glass-card min-h-[44px] transition-all"
        >
          Save observation
        </button>
      </div>
    </form>
  );
};
