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
      <div className="glass-card rounded-3xl p-6 shadow-glass-card border border-palette-frost/25 font-sans">
        <h3 className="text-base font-bold text-palette-cream mb-1.5">Critical Reconnaissance Edges</h3>
        <p className="text-xs text-palette-frost">
          No critical hazard bottlenecks identified. All active routes meet reliability thresholds.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl p-6 shadow-glass-card border border-palette-frost/25 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 border-b border-palette-slate/25 pb-3 gap-2">
        <div>
          <h3 className="text-base font-bold text-palette-cream">Value of Information (VOI) Ranking</h3>
          <p className="text-xs text-palette-frost mt-0.5">
            Top bottleneck road edges prioritized for field drone / ground inspection.
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-3 py-1 rounded-xl glass-card-subtle text-palette-cream border border-palette-frost/25 self-start sm:self-auto">
          {recommendations.length} Bottlenecks Identified
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs font-mono">
          <thead className="bg-palette-deep/80 border-b border-palette-slate/25 text-palette-frost text-[11px]">
            <tr>
              <th className="py-3 px-3">Rank</th>
              <th className="py-3 px-3">Edge ID</th>
              <th className="py-3 px-3">VOI Score</th>
              <th className="py-3 px-3">Minutes saved</th>
              <th className="py-3 px-3">Inspection Cost</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-palette-slate/20 text-palette-cream">
            {recommendations.map((rec) => (
              <tr
                key={rec.edge_id}
                className="hover:bg-palette-steel/20 transition-colors cursor-pointer"
                onClick={() => onSelectEdge && onSelectEdge(rec.edge_id)}
              >
                <td className="py-2.5 px-3 font-semibold text-palette-cream">#{rec.priority_rank}</td>
                <td className="py-2.5 px-3 text-palette-frost font-bold">
                  {rec.edge_id}
                </td>
                <td className="py-2.5 px-3 font-bold text-amber-300">
                  {rec.voi_score.toFixed(3)}
                </td>
                <td className="py-2.5 px-3 text-palette-sage">
                  {rec.expected_regret_reduction.toFixed(1)} min
                </td>
                <td className="py-2.5 px-3 text-palette-frost">
                  ${rec.inspection_cost.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span className="px-2.5 py-1 text-[10px] font-bold rounded-lg glass-card-subtle text-palette-frost hover:text-palette-cream border border-palette-frost/25 inline-block">
                    Inspect Corridor
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
