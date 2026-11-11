import React from 'react';
import { ReconnaissanceRecommendation } from '../api/client';

export interface VoiMapOverlayProps {
  targets: ReconnaissanceRecommendation[];
  selectedEdgeId?: string | null;
  onSelectTarget: (edgeId: string) => void;
}

export const VoiMapOverlay: React.FC<VoiMapOverlayProps> = ({
  targets,
  selectedEdgeId,
  onSelectTarget,
}) => {
  return (
    <div className="glass-card rounded-3xl p-6 shadow-glass-card border border-palette-frost/25 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-3 mb-4 border-b border-palette-slate/25 gap-2">
        <div>
          <h3 className="text-base font-bold text-palette-cream">Reconnaissance Priority Overlay</h3>
          <p className="text-xs text-palette-frost mt-0.5">
            Field drone dispatch guidance ranked by regret reduction per reconnaissance unit.
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl glass-card-subtle text-palette-cream border border-palette-frost/25 self-start sm:self-auto">
          EVPI/EVSI Guided
        </span>
      </div>

      <div className="space-y-2.5">
        {targets.map((tgt) => {
          const isSelected = selectedEdgeId === tgt.edge_id;
          return (
            <div
              key={tgt.edge_id}
              onClick={() => onSelectTarget(tgt.edge_id)}
              className={`p-3.5 rounded-2xl border text-xs cursor-pointer transition-all ${
                isSelected
                  ? 'glass-card border-palette-frost shadow-glass-glow'
                  : 'glass-card-subtle hover:border-palette-frost/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold px-2 py-0.5 rounded-md bg-palette-deep/90 text-palette-cream border border-palette-frost/30 text-[10px] font-mono">
                    #{tgt.priority_rank}
                  </span>
                  <span className="font-mono font-bold text-palette-cream">{tgt.edge_id}</span>
                </div>
                <span className="font-mono font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-800/40 text-[11px]">
                  VoI: {tgt.voi_score.toFixed(3)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-palette-frost mt-1 font-mono">
                <span>
                  Minutes saved by inspecting: <b className="text-palette-cream">{tgt.expected_regret_reduction.toFixed(1)} min</b>
                </span>
                <span>
                  Cost: <b className="text-palette-cream">${tgt.inspection_cost}</b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
