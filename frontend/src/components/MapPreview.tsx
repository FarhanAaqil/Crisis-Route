import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RoadLayer, RoadEdgeStyle, MapNodeItem } from '../map/RoadLayer';

interface MapPreviewProps {
  regionName: string;
  bbox: number[];
  edges: RoadEdgeStyle[];
  nodes?: MapNodeItem[];
  selectedEdgeId?: string | null;
  onSelectEdge?: (edge: RoadEdgeStyle) => void;
  highlightedEdgeIds?: string[];
}

export const MapPreview: React.FC<MapPreviewProps> = ({
  regionName,
  bbox,
  edges,
  nodes = [],
  selectedEdgeId,
  onSelectEdge,
  highlightedEdgeIds = [],
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [internalSelectedEdge, setInternalSelectedEdge] = useState<RoadEdgeStyle | null>(null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [webglError, setWebglError] = useState<boolean>(false);

  const activeSelected = edges.find((e) => e.edge_id === selectedEdgeId) || internalSelectedEdge;

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      const centerLon = (bbox[0] + bbox[2]) / 2.0;
      const centerLat = (bbox[1] + bbox[3]) / 2.0;

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'osm-raster': {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm-raster',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [centerLon, centerLat],
        zoom: 10,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      map.on('load', () => {
        setIsMapReady(true);
      });

      mapRef.current = map;
    } catch {
      // Environments without WebGL: schedule the notice outside the effect body
      queueMicrotask(() => setWebglError(true));
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [bbox[0], bbox[1], bbox[2], bbox[3]]);

  // Update edges GeoJSON layer on map when edges or highlightedEdgeIds change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // Filter valid edges with coordinates
    const features = edges
      .filter((e) => e.u_coord && e.v_coord)
      .map((e) => {
        const isHighlighted = highlightedEdgeIds.includes(e.edge_id);
        const isSelected = activeSelected?.edge_id === e.edge_id;

        let strokeColor = '#10b981'; // green
        if (e.passability_prob < 0.5) strokeColor = '#ef4444'; // red
        else if (e.passability_prob < 0.8) strokeColor = '#f59e0b'; // amber

        if (isSelected) strokeColor = '#2563eb'; // blue

        return {
          type: 'Feature' as const,
          properties: {
            edge_id: e.edge_id,
            road_class: e.road_class,
            length_m: e.length_m,
            passability_prob: e.passability_prob,
            bridge: e.bridge,
            color: strokeColor,
            width: isSelected || isHighlighted ? 5 : e.bridge ? 4 : 3,
            dash: e.bridge ? [2, 2] : [1, 0],
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: [e.u_coord!, e.v_coord!],
          },
        };
      });

    const geojsonData: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    if (map.getSource('road-edges-source')) {
      (map.getSource('road-edges-source') as maplibregl.GeoJSONSource).setData(geojsonData);
    } else {
      map.addSource('road-edges-source', {
        type: 'geojson',
        data: geojsonData,
      });

      map.addLayer({
        id: 'road-edges-lines',
        type: 'line',
        source: 'road-edges-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'width'],
        },
      });

      // Interactive click on road edges
      map.on('click', 'road-edges-lines', (ev) => {
        if (!ev.features || ev.features.length === 0) return;
        const feat = ev.features[0];
        const clickedEdgeId = feat.properties?.edge_id;
        const found = edges.find((item) => item.edge_id === clickedEdgeId);
        if (found) {
          setInternalSelectedEdge(found);
          if (onSelectEdge) onSelectEdge(found);
        }
      });

      map.on('mouseenter', 'road-edges-lines', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'road-edges-lines', () => {
        map.getCanvas().style.cursor = '';
      });
    }

    // Render node markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    nodes.forEach((n) => {
      const el = document.createElement('div');
      el.className = 'cursor-pointer transform hover:scale-110 transition-transform';

      if (n.node_type === 'depot') {
        el.innerHTML = `
          <div class="flex items-center gap-1 px-2 py-0.5 rounded shadow-md bg-blue-700 text-white border border-white text-[10px] font-bold">
            <span>&#9951;</span>
            <span>${n.name.split(' ')[0]}</span>
          </div>
        `;
      } else if (n.node_type === 'demand') {
        const isVuln = !!n.vulnerable_group;
        el.innerHTML = `
          <div class="flex items-center gap-1 px-2 py-0.5 rounded shadow-md ${
            isVuln ? 'bg-rose-700' : 'bg-purple-700'
          } text-white border border-white text-[10px] font-bold">
            <span>&#9873;</span>
            <span>${n.name.split(' ')[0]}</span>
            ${isVuln ? '<span class="text-[9px] bg-rose-900 px-1 rounded">&#9888;</span>' : ''}
          </div>
        `;
      } else {
        el.innerHTML = `
          <div class="w-3 h-3 rounded-full bg-slate-600 border-2 border-white shadow-sm"></div>
        `;
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(n.coordinates)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [edges, nodes, isMapReady, highlightedEdgeIds, activeSelected?.edge_id]);

  const handleSelect = (edge: RoadEdgeStyle) => {
    setInternalSelectedEdge(edge);
    if (onSelectEdge) onSelectEdge(edge);

    // If map is active and edge has coordinates, pan to it
    if (mapRef.current && edge.u_coord && edge.v_coord) {
      const midLon = (edge.u_coord[0] + edge.v_coord[0]) / 2.0;
      const midLat = (edge.u_coord[1] + edge.v_coord[1]) / 2.0;
      mapRef.current.easeTo({ center: [midLon, midLat], zoom: 11 });
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-xs">
      <div className="bg-slate-800 text-white p-3 flex justify-between items-center text-xs">
        <div>
          <span className="font-bold text-sm">{regionName}</span>
          <span className="ml-2 font-mono text-slate-300">
            [{bbox.map((c) => c.toFixed(2)).join(', ')}]
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 bg-slate-700 rounded text-emerald-400 font-medium font-mono text-[11px]">
            WGS84 / EPSG:4326
          </span>
          <span className="px-2 py-0.5 bg-slate-700 rounded text-slate-300 text-[11px]">
            {edges.length} Corridors
          </span>
          {nodes.length > 0 && (
            <span className="px-2 py-0.5 bg-slate-700 rounded text-purple-300 text-[11px]">
              {nodes.length} Nodes
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
        {/* Real Map Canvas */}
        <div className="lg:col-span-2 h-80 sm:h-96 rounded border border-slate-200 relative overflow-hidden bg-slate-100">
          <div ref={mapContainerRef} className="w-full h-full" />

          {webglError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-100 text-slate-600">
              <div className="font-bold text-sm mb-1">Spatial Network Renderer</div>
              <p className="text-xs max-w-sm text-slate-500">
                Corridor overview active for {regionName}. WebGL hardware acceleration simulated.
              </p>
              <div className="mt-3 flex gap-2">
                <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                  &#x25CF; &ge;80% Passable
                </span>
                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded font-semibold text-[11px]">
                  &#x25CF; 50-79% Moderate
                </span>
                <span className="px-2 py-1 bg-rose-100 text-rose-800 rounded font-semibold text-[11px]">
                  &#x25CF; &lt;50% Critical
                </span>
              </div>
            </div>
          )}

          {/* Active Legend Overlay */}
          <div className="absolute top-2 left-2 p-2 bg-white/95 backdrop-blur-xs border border-slate-200 rounded shadow-xs text-[11px] space-y-1 pointer-events-none">
            <div className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">
              Corridor Legend
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-1 bg-emerald-500 rounded"></span>
              <span>Passable (&ge;80%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-1 bg-amber-500 rounded"></span>
              <span>Moderate (50-79%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-1 bg-rose-500 rounded"></span>
              <span>Critical (&lt;50%)</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-700">
              <span className="w-3 h-1 border-t-2 border-dashed border-amber-600"></span>
              <span>River Bridge</span>
            </div>
          </div>

          {/* Selected Edge Detail Card */}
          {activeSelected && (
            <div className="absolute bottom-2 left-2 right-2 p-2.5 bg-white/95 backdrop-blur-xs border border-slate-200 rounded shadow-md text-slate-800 text-xs flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                  {activeSelected.edge_id}
                </span>
                <span className="capitalize text-slate-600">Class: {activeSelected.road_class}</span>
                {activeSelected.bridge && (
                  <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">
                    Bridge
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span>{(activeSelected.length_m / 1000).toFixed(1)} km</span>
                <span>{Math.round(activeSelected.free_flow_sec / 60)} min</span>
                <span
                  className={`font-bold ${
                    activeSelected.passability_prob >= 0.8
                      ? 'text-emerald-700'
                      : activeSelected.passability_prob >= 0.5
                      ? 'text-amber-700'
                      : 'text-rose-700'
                  }`}
                >
                  {(activeSelected.passability_prob * 100).toFixed(0)}% Passable
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Road Layers List Panel */}
        <div className="lg:col-span-1">
          <RoadLayer
            edges={edges}
            selectedEdgeId={activeSelected?.edge_id}
            onSelectEdge={handleSelect}
          />
        </div>
      </div>
    </div>
  );
};
