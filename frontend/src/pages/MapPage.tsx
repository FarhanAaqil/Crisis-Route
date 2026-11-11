import React, { Suspense, lazy, useState } from 'react';
import { Compass, Layers, Sparkles } from 'lucide-react';
import { fetchPassability } from '../api/client';
import { useApp } from '../context/AppContext';
import { useAsync } from '../hooks/useAsync';
import { Skeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateViews';
import { ModelStatus } from './ModelStatus';

// Heavy 3D / GIS engines load only when the Map tab is opened
const ThreeCorridorVisualizer = lazy(() =>
  import('../components/ThreeCorridorVisualizer').then((m) => ({ default: m.ThreeCorridorVisualizer })),
);
const MapPreview = lazy(() => import('../components/MapPreview').then((m) => ({ default: m.MapPreview })));

const FALLBACK_BBOX = [75.9, 11.45, 76.4, 11.95];

export const MapPage: React.FC = () => {
  const { activeScenarioId, activeScenario, scenarioDetail } = useApp();
  const [engine, setEngine] = useState<'3d' | '2d'>('3d');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const passability = useAsync(
    () => (activeScenarioId ? fetchPassability(activeScenarioId) : Promise.resolve(null)),
    [activeScenarioId],
  );

  const edges = passability.data?.edges ?? [];
  const nodes = passability.data?.nodes ?? [];
  const selected = selectedEdgeId ?? edges[0]?.edge_id ?? null;
  const bbox = scenarioDetail?.region.bbox ?? FALLBACK_BBOX;
  const title = activeScenario?.name ?? 'Regional Disaster Corridor';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-card p-4 rounded-2xl border border-palette-frost/25 shadow-glass-card">
        <div>
          <h2 className="text-base font-bold text-palette-cream flex items-center space-x-2">
            <Compass className="w-5 h-5 text-palette-frost" />
            <span>Road Corridor Passability &amp; Risk</span>
          </h2>
          <p className="text-xs text-palette-frost/85 mt-0.5">
            Pass probability and 95% interval for every road link. Select a link to inspect it.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto glass-card-subtle p-1 rounded-xl border border-palette-frost/25 text-xs">
          {(
            [
              ['3d', 'Tactical 3D', Sparkles],
              ['2d', 'Map view', Layers],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={engine === id}
              onClick={() => setEngine(id)}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 transition-all min-h-[36px] ${
                engine === id ? 'glass-btn-primary text-palette-cream' : 'text-palette-frost hover:text-palette-cream'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {passability.error ? (
        <ErrorState message={passability.error} onRetry={passability.reload} />
      ) : passability.loading && !passability.data ? (
        <Skeleton className="h-[420px] w-full rounded-3xl" />
      ) : edges.length === 0 ? (
        <EmptyState title="No road links for this scenario" hint="Import a road network or pick another sector." />
      ) : (
        <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-3xl" />}>
          {engine === '3d' ? (
            <ThreeCorridorVisualizer
              edges={edges}
              nodes={nodes}
              selectedEdgeId={selected}
              onSelectEdge={(e) => setSelectedEdgeId(e.edge_id)}
              regionName={title}
            />
          ) : (
            <MapPreview
              regionName={title}
              bbox={bbox}
              edges={edges}
              nodes={nodes}
              selectedEdgeId={selected}
              onSelectEdge={(e) => setSelectedEdgeId(e.edge_id)}
            />
          )}
        </Suspense>
      )}

      {passability.data && (
        <p className="text-[11px] text-palette-frost/80">
          Road network source: <span className="font-mono">{passability.data.graph_source}</span>. Passability is
          updated from field observations in real time.
        </p>
      )}

      <ModelStatus />
    </div>
  );
};

export default MapPage;
