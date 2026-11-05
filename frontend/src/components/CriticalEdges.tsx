import React from 'react';
import { ReconnaissanceRecommendation } from '../api/client';

export interface CriticalEdgesProps {
  recommendations: ReconnaissanceRecommendation[];
  onSelectEdge?: (edgeId: string) => void;
}

export const CriticalEdges: React.FC<CriticalEdgesProps> = ({
  recommendations,
  onSelectEdge,
}) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="text-base font-semibold text-slate-800 mb-2">Critical Reconnaissance Edges</h3>
        <p className="text-sm text-slate-500">
          No critical hazard bottlenecks identified. All active routes meet reliability thresholds.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Value of Information (VOI) Ranking</h3>
          <p className="text-xs text-slate-500">
            Top bottleneck road edges prioritized for field drone / ground inspection.
          </p>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
          {recommendations.length} Targets
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
            <tr>
              <th className="py-2 px-3">Rank</th>
              <th className="py-2 px-3">Edge ID</th>
              <th className="py-2 px-3">VOI Score</th>
              <th className="py-2 px-3">Regret Reduction</th>
              <th className="py-2 px-3">Inspection Cost</th>
              <th className="py-2 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {recommendations.map((rec) => (
              <tr
                key={rec.edge_id}
                className="hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => onSelectEdge && onSelectEdge(rec.edge_id)}
              >
                <td className="py-2.5 px-3 font-semibold text-slate-700">#{rec.priority_rank}</td>
                <td className="py-2.5 px-3 font-mono text-xs text-blue-700 font-medium">
                  {rec.edge_id}
                </td>
                <td className="py-2.5 px-3">
                  <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                    {rec.voi_score.toFixed(3)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  -{rec.expected_regret_reduction.toFixed(1)} min
                </td>
                <td className="py-2.5 px-3 text-slate-500">${rec.inspection_cost.toFixed(0)}</td>
                <td className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium py-1 px-2.5 rounded transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectEdge) onSelectEdge(rec.edge_id);
                    }}
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

