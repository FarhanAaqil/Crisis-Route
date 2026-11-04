import React from 'react';

export interface EdgeUncertainty {
  edge_id: string;
  probability: number;
  interval: [number, number];
  is_conflicted: boolean;
  is_shifted: boolean;
}

interface UncertaintyLayerProps {
  uncertainties: EdgeUncertainty[];
  onSelect?: (edgeId: string) => void;
}

export const UncertaintyLayer: React.FC<UncertaintyLayerProps> = ({
  uncertainties,
  onSelect,
}) => {
  return (
    <div className="p-3 bg-white border rounded-md space-y-2 text-xs">
      <div className="flex justify-between items-center border-b pb-1">
        <span className="font-bold text-slate-800">Uncertainty &amp; Confidence Halos</span>
        <span className="text-slate-400 text-[10px]">Bootstrap 10th-90th %ile</span>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {uncertainties.map((item) => {
          const spread = item.interval[1] - item.interval[0];
          const isHighUncertainty = spread > 0.40 || item.is_conflicted;

          return (
            <div
              key={item.edge_id}
              onClick={() => onSelect && onSelect(item.edge_id)}
              className={`p-2 rounded border cursor-pointer hover:shadow-xs transition ${
                item.is_shifted
                  ? 'bg-purple-50 border-purple-200 text-purple-900'
                  : item.is_conflicted
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-mono font-bold text-[11px]">{item.edge_id}</span>
                <span className="font-semibold">{(item.probability * 100).toFixed(0)}%</span>
              </div>

              {/* Spread bar */}
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden relative">
                <div
                  className={`h-full ${
                    item.is_shifted ? 'bg-purple-600' : isHighUncertainty ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{
                    marginLeft: `${item.interval[0] * 100}%`,
                    width: `${spread * 100}%`,
                  }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>
                  [{item.interval[0].toFixed(2)} - {item.interval[1].toFixed(2)}]
                </span>
                {item.is_conflicted && (
                  <span className="font-bold text-amber-700 uppercase tracking-tighter">Contradiction</span>
                )}
                {item.is_shifted && (
                  <span className="font-bold text-purple-700 uppercase tracking-tighter">Shift Alert</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
