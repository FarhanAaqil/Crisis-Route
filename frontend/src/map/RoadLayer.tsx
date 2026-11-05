import React from 'react';

export interface RoadEdgeStyle {
  edge_id: string;
  road_class: string;
  length_m: number;
  free_flow_sec: number;
  passability_prob: number;
  bridge: boolean;
  u_coord?: [number, number];
  v_coord?: [number, number];
  u_node?: string;
  v_node?: string;
  risk_class?: string;
}

export interface MapNodeItem {
  node_id: string;
  name: string;
  node_type: 'depot' | 'demand' | 'junction';
  coordinates: [number, number];
  vulnerable_group?: string | null;
  population?: number | null;
}

interface RoadLayerProps {
  edges: RoadEdgeStyle[];
  selectedEdgeId?: string | null;
  onSelectEdge?: (edge: RoadEdgeStyle) => void;
}

export const RoadLayer: React.FC<RoadLayerProps> = ({ edges, selectedEdgeId, onSelectEdge }) => {
  const getRoadColor = (prob: number, isSelected: boolean) => {
    if (isSelected) {
      return 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-500 text-blue-900 shadow-sm';
    }
    if (prob >= 0.8) return 'text-emerald-800 bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/50';
    if (prob >= 0.5) return 'text-amber-800 bg-amber-50/70 border-amber-200 hover:bg-amber-100/50';
    return 'text-rose-800 bg-rose-50/70 border-rose-200 hover:bg-rose-100/50';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-semibold text-slate-700 pb-1 border-b">
        <span>Road Corridor Segments</span>
        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-600">
          {edges.length} Active
        </span>
      </div>
      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {edges.map((e) => {
          const isSelected = selectedEdgeId === e.edge_id;
          return (
            <div
              key={e.edge_id}
              onClick={() => onSelectEdge && onSelectEdge(e)}
              className={`p-2 rounded border text-xs flex justify-between items-center cursor-pointer transition ${getRoadColor(
                e.passability_prob,
                isSelected
              )}`}
            >
              <div className="truncate mr-2">
                <span className="font-mono font-bold">{e.edge_id}</span>
                <span className="ml-1.5 capitalize text-slate-500 font-sans text-[11px]">
                  ({e.road_class})
                </span>
                {e.bridge && (
                  <span className="ml-1 text-[10px] px-1 bg-amber-200 text-amber-900 rounded font-semibold">
                    Bridge
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="font-bold font-mono">{(e.passability_prob * 100).toFixed(0)}%</span>{' '}
                <span className="text-[10px] uppercase font-semibold">
                  {e.passability_prob >= 0.8 ? 'Pass' : e.passability_prob >= 0.5 ? 'Mod' : 'Crit'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
