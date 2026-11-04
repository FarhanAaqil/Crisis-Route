import React from 'react';

export interface RoadEdgeStyle {
  edge_id: string;
  road_class: string;
  length_m: number;
  free_flow_sec: number;
  passability_prob: number;
  bridge: boolean;
}

interface RoadLayerProps {
  edges: RoadEdgeStyle[];
  onSelectEdge?: (edge: RoadEdgeStyle) => void;
}

export const RoadLayer: React.FC<RoadLayerProps> = ({ edges, onSelectEdge }) => {
  const getRoadColor = (prob: number) => {
    if (prob >= 0.8) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (prob >= 0.5) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-semibold text-slate-700 pb-1 border-b">
        <span>Road Corridor Segments</span>
        <span>Count: {edges.length}</span>
      </div>
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {edges.map((e) => (
          <div
            key={e.edge_id}
            onClick={() => onSelectEdge && onSelectEdge(e)}
            className={`p-2 rounded border text-xs flex justify-between items-center cursor-pointer hover:shadow-xs transition ${getRoadColor(
              e.passability_prob
            )}`}
          >
            <div>
              <span className="font-mono font-bold">{e.edge_id}</span>
              <span className="ml-2 capitalize text-slate-500 font-sans">({e.road_class})</span>
              {e.bridge && <span className="ml-1 text-[10px] px-1 bg-slate-200 text-slate-700 rounded">Bridge</span>}
            </div>
            <div className="text-right">
              <span className="font-bold">{(e.passability_prob * 100).toFixed(0)}%</span> Passable
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

