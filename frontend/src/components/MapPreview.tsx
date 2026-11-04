import React, { useState } from 'react';
import { RoadLayer, RoadEdgeStyle } from '../map/RoadLayer';

interface MapPreviewProps {
  regionName: string;
  bbox: number[];
  edges: RoadEdgeStyle[];
}

export const MapPreview: React.FC<MapPreviewProps> = ({ regionName, bbox, edges }) => {
  const [selectedEdge, setSelectedEdge] = useState<RoadEdgeStyle | null>(null);

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-xs">
      <div className="bg-slate-800 text-white p-3 flex justify-between items-center text-xs">
        <div>
          <span className="font-bold text-sm">{regionName}</span>
          <span className="ml-2 font-mono text-slate-300">
            [{bbox.map((c) => c.toFixed(2)).join(', ')}]
          </span>
        </div>
        <div className="flex space-x-2">
          <span className="px-2 py-0.5 bg-slate-700 rounded text-emerald-400 font-medium">EPSG:4326</span>
          <span className="px-2 py-0.5 bg-slate-700 rounded text-slate-300">{edges.length} Segments</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 p-4">
        {/* Mock Map Canvas Stub */}
        <div className="col-span-2 h-64 bg-slate-100 rounded border border-slate-200 relative flex flex-col items-center justify-center text-slate-400 text-xs">
          <div className="font-semibold text-slate-600 mb-1">Spatial Network Canvas (MapLibre Engine)</div>
          <p className="text-center max-w-xs text-[11px] text-slate-500">
            Interactive vector tile renderer displaying road links colored by predicted passability probabilities and flood overlay rasters.
          </p>
          {selectedEdge && (
            <div className="absolute bottom-2 left-2 right-2 p-2 bg-white/90 backdrop-blur-xs border rounded text-slate-800 text-xs flex justify-between">
              <span className="font-mono font-bold">{selectedEdge.edge_id}</span>
              <span>Class: {selectedEdge.road_class}</span>
              <span>Length: {selectedEdge.length_m}m</span>
              <span className="font-bold text-emerald-600">{(selectedEdge.passability_prob * 100).toFixed(0)}% Passable</span>
            </div>
          )}
        </div>

        {/* Road Layers Side Panel */}
        <div className="col-span-1">
          <RoadLayer edges={edges} onSelectEdge={(e) => setSelectedEdge(e)} />
        </div>
      </div>
    </div>
  );
};

