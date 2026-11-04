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
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Reconnaissance Priority Overlay</h3>
          <p className="text-[11px] text-slate-500">
            Field drone dispatch guidance ranked by regret reduction per reconnaissance unit.
          </p>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
          EVPI/EVSI Guided
        </span>
      </div>

      <div className="space-y-2">
        {targets.map((tgt) => {
          const isSelected = selectedEdgeId === tgt.edge_id;
          return (
            <div
              key={tgt.edge_id}
              onClick={() => onSelectTarget(tgt.edge_id)}
              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/70 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold px-1.5 py-0.2 rounded bg-slate-800 text-white text-[10px]">
                    #{tgt.priority_rank}
                  </span>
                  <span className="font-mono font-semibold text-slate-800">{tgt.edge_id}</span>
                </div>
                <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                  VoI: {tgt.voi_score.toFixed(3)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
                <span>
                  Regret Reduction: <b className="text-slate-800">-{tgt.expected_regret_reduction.toFixed(1)}m</b>
                </span>
                <span>
                  Cost: <b className="text-slate-800">${tgt.inspection_cost}</b>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
