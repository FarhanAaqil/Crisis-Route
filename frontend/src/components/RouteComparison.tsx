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
    <div className="bg-white border rounded-lg p-4 space-y-4 font-sans text-xs shadow-xs">
      <div className="flex justify-between items-center border-b pb-2">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Diverse Route Alternatives (Yen k-Shortest)</h3>
          <p className="text-slate-500">Destination: {destinationName} &bull; Fleet Unit: {vehicleId}</p>
        </div>
        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-medium">
          k = {routes.length} Loopless Paths
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {routes.map((r) => {
          const isSelected = r.rank === selectedRank;
          const isPrimary = r.rank === 1;

          return (
            <div
              key={r.rank}
              onClick={() => onSelectRoute(r.rank)}
              className={`p-3 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className={`font-bold ${isPrimary ? 'text-blue-800' : 'text-slate-700'}`}>
                    {isPrimary ? 'Primary Shortest' : `Alternative ${r.rank - 1}`}
                  </span>
                  <span
                    className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${
                      r.survival_prob >= 0.80
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.survival_prob >= 0.50
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {(r.survival_prob * 100).toFixed(1)}% Survival
                  </span>
                </div>

                <div className="space-y-1 text-slate-600 mb-3">
                  <div className="flex justify-between">
                    <span>Est. Travel Time:</span>
                    <span className="font-semibold text-slate-900">{r.travel_time_min} mins</span>
                  </div>
                  {!isPrimary && (
                    <>
                      <div className="flex justify-between">
                        <span>ETA Inflation:</span>
                        <span className="font-semibold text-amber-700">+{r.eta_inflation_pct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Jaccard Overlap:</span>
                        <span className="font-semibold text-slate-800">
                          {(r.jaccard_overlap_with_primary * 100).toFixed(0)}%
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Links traversed:</span>
                    <span>{r.edge_path.length} segments</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t flex justify-end">
                <span
                  className={`text-[11px] font-semibold ${
                    isSelected ? 'text-blue-600' : 'text-slate-400'
                  }`}
                >
                  {isSelected ? '✓ Selected Route' : 'Select Path'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
