import React from 'react';

export interface RouteOption {
  rank: number;
  node_path: string[];
  edge_path: string[];
  travel_time_min: number;
  survival_prob: number;
  jaccard_overlap_with_primary: number;
  eta_inflation_pct: number;
}

interface RouteComparisonProps {
  vehicleId: string;
  destinationName: string;
  routes: RouteOption[];
  selectedRank: number;
  onSelectRoute: (rank: number) => void;
}

export const RouteComparison: React.FC<RouteComparisonProps> = ({
  vehicleId,
  destinationName,
  routes,
  selectedRank,
  onSelectRoute,
}) => {
  return (
    <div className="glass-card rounded-3xl p-6 space-y-4 font-sans text-xs shadow-glass-card border border-palette-frost/25">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-palette-slate/25 pb-3 gap-2">
        <div>
          <h3 className="font-bold text-palette-cream text-sm">Diverse Route Alternatives (Yen k-Shortest)</h3>
          <p className="text-palette-frost mt-0.5">Destination: {destinationName} &bull; Fleet Unit: {vehicleId}</p>
        </div>
        <span className="px-3 py-1 glass-card-subtle text-palette-cream border border-palette-frost/25 rounded-xl font-mono text-[11px] self-start sm:self-auto">
          k = {routes.length} Loopless Paths
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {routes.map((r) => {
          const isSelected = r.rank === selectedRank;
          const isPrimary = r.rank === 1;

          return (
            <div
              key={r.rank}
              onClick={() => onSelectRoute(r.rank)}
              className={`p-4 rounded-2xl cursor-pointer transition-all flex flex-col justify-between ${
                isSelected
                  ? 'glass-card border-palette-frost shadow-glass-glow ring-1 ring-palette-frost'
                  : 'glass-card-subtle hover:border-palette-frost/40'
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <span className={`font-bold ${isPrimary ? 'text-palette-cream font-extrabold' : 'text-palette-frost'}`}>
                    {isPrimary ? 'Primary Shortest' : `Alternative ${r.rank - 1}`}
                  </span>
                  <span
                    className={`font-mono text-xs px-2 py-0.5 rounded-full font-bold ${
                      r.survival_prob >= 0.75
                        ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40'
                        : 'bg-amber-950/70 text-amber-300 border border-amber-800/40'
                    }`}
                  >
                    {(r.survival_prob * 100).toFixed(1)} % Survival
                  </span>
                </div>

                <div className="space-y-1.5 text-palette-frost font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-palette-slate font-sans">ETA Travel Time:</span>
                    <span className="text-palette-cream font-bold">{r.travel_time_min.toFixed(1)} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-palette-slate font-sans">ETA Inflation:</span>
                    <span className={r.eta_inflation_pct > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                      +{r.eta_inflation_pct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-palette-slate font-sans">Primary Overlap:</span>
                    <span className="text-palette-frost">{(r.jaccard_overlap_with_primary * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-palette-slate/20 text-[10px] text-palette-slate font-mono truncate">
                {r.edge_path.join(' → ')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
