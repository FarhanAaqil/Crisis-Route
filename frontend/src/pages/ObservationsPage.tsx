import React, { useMemo, useState } from 'react';
import { Radio, Search } from 'lucide-react';
import { fetchObservations, fetchPassability, submitObservation, ObservationResponse } from '../api/client';
import { useApp } from '../context/AppContext';
import { useAsync, errorMessage } from '../hooks/useAsync';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { ObservationEditor, ObservationFormData } from '../components/ObservationEditor';
import { CardSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateViews';

const CAN_REPORT = new Set(['field_analyst', 'analyst', 'admin']);

const STATUS_STYLE: Record<ObservationResponse['status'], string> = {
  passable: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50',
  debris_cleared: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50',
  impassable: 'bg-rose-950/80 text-rose-300 border border-rose-800/50',
  partially_blocked: 'bg-amber-950/80 text-amber-300 border border-amber-800/50',
};

export const ObservationsPage: React.FC = () => {
  const { activeScenarioId, activeRole, notify, isOnline } = useApp();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [submitting, setSubmitting] = useState(false);

  const passability = useAsync(
    () => (activeScenarioId ? fetchPassability(activeScenarioId) : Promise.resolve(null)),
    [activeScenarioId],
  );
  const observations = useAsync(
    () => (activeScenarioId ? fetchObservations(activeScenarioId, 50) : Promise.resolve([])),
    [activeScenarioId],
  );

  const edges = useMemo(() => passability.data?.edges ?? [], [passability.data]);
  const filteredEdges = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return q ? edges.filter((e) => e.edge_id.toLowerCase().includes(q)) : edges;
  }, [edges, debouncedSearch]);
  const edgeId = selectedEdgeId || filteredEdges[0]?.edge_id || '';
  const canReport = CAN_REPORT.has(activeRole);

  const handleSubmit = async (data: ObservationFormData) => {
    setSubmitting(true);
    try {
      await submitObservation(activeScenarioId, { ...data });
      notify(`Report for ${data.edge_id} recorded. Existing plans are now stale: re-optimize before sign-off.`, 'success');
      observations.reload();
      passability.reload();
    } catch (err) {
      notify(`Report was not saved: ${errorMessage(err)}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 rounded-2xl border border-palette-frost/25 shadow-glass-card">
        <h2 className="text-lg font-bold text-palette-cream flex items-center space-x-2">
          <Radio className="w-5 h-5 text-palette-frost" />
          <span>Field Observations</span>
        </h2>
        <p className="text-xs text-palette-frost/85 mt-0.5">
          Report what you see on a road link. Reports are weighted by source credibility and fade as they age.
        </p>
      </div>

      {!isOnline && (
        <div role="status" className="p-3 rounded-xl text-xs bg-amber-950/60 border border-amber-800 text-amber-200">
          You are offline. Reports cannot be saved until the connection returns.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="glass-card p-5 rounded-2xl border border-palette-frost/25 shadow-glass-card space-y-4">
          <h3 className="text-sm font-bold text-palette-cream">Record an observation</h3>

          {!canReport ? (
            <EmptyState title="Read-only role" hint="Approvers review reports but cannot file them." />
          ) : passability.error ? (
            <ErrorState message={passability.error} onRetry={passability.reload} />
          ) : (
            <>
              <div className="space-y-2">
                <label htmlFor="edge-search" className="text-xs font-semibold text-palette-frost flex items-center gap-1">
                  <Search className="w-3.5 h-3.5" /> Find a road link
                </label>
                <input
                  id="edge-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type part of a link id"
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-palette-cream focus:outline-none focus:ring-2 focus:ring-palette-frost"
                />
                <label htmlFor="edge-selector" className="sr-only">
                  Road link
                </label>
                <select
                  id="edge-selector"
                  value={edgeId}
                  onChange={(e) => setSelectedEdgeId(e.target.value)}
                  className="w-full glass-input rounded-xl px-2.5 py-2 text-xs text-palette-cream font-mono focus:outline-none focus:ring-2 focus:ring-palette-frost"
                >
                  {filteredEdges.map((e) => (
                    <option key={e.edge_id} value={e.edge_id} className="bg-palette-deep text-palette-cream">
                      {e.edge_id} ({e.road_class}, p={e.passability_prob.toFixed(2)})
                    </option>
                  ))}
                </select>
                {filteredEdges.length === 0 && !passability.loading && (
                  <p className="text-[11px] text-palette-frost">No link matches this search.</p>
                )}
              </div>

              {edgeId ? (
                <ObservationEditor edgeId={edgeId} onSubmit={handleSubmit} disabled={submitting || !isOnline} />
              ) : (
                <CardSkeleton />
              )}
            </>
          )}
        </section>

        <section className="glass-card p-5 rounded-2xl border border-palette-frost/25 shadow-glass-card flex flex-col">
          <h3 className="text-sm font-bold text-palette-cream mb-3">
            Recent observations{observations.data ? ` (${observations.data.length})` : ''}
          </h3>
          {observations.error ? (
            <ErrorState message={observations.error} onRetry={observations.reload} />
          ) : observations.loading && !observations.data ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (observations.data ?? []).length === 0 ? (
            <EmptyState title="No observations yet" hint="Field reports appear here as soon as they are filed." />
          ) : (
            <ul className="space-y-3 overflow-y-auto max-h-[480px] pr-1">
              {(observations.data ?? []).map((obs) => (
                <li
                  key={obs.observation_id}
                  className="p-3.5 border border-palette-slate/25 rounded-xl text-xs glass-card-subtle space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-palette-frost truncate">{obs.edge_id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[obs.status]}`}>
                      {obs.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-palette-frost/85">
                    {obs.source_type.replace('_', ' ')} · credibility{' '}
                    <span className="font-semibold text-palette-cream">{Math.round(obs.source_credibility * 100)}%</span>
                    {obs.water_depth_cm ? <> · water {obs.water_depth_cm} cm</> : null}
                  </div>
                  {obs.notes && <p className="text-palette-cream italic border-l-2 border-palette-slate/50 pl-2">{obs.notes}</p>}
                  <time className="block text-[10px] text-palette-slate font-mono" dateTime={obs.timestamp}>
                    {new Date(obs.timestamp).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default ObservationsPage;
