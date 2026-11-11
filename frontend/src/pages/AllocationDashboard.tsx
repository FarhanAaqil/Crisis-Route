import React, { useMemo, useState } from 'react';
import { Cpu } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ApiError,
  InfeasibilityDiagnostic,
  fetchRouteAlternatives,
  fetchScenarioFan,
  fetchVoiRankings,
  optimizePlan,
} from '../api/client';
import { useAsync, errorMessage } from '../hooks/useAsync';
import { AllocationTable } from '../components/AllocationTable';
import { CriticalEdges } from '../components/CriticalEdges';
import { EquityMetrics } from '../components/EquityMetrics';
import { SolverDiagnostics } from '../components/SolverDiagnostics';
import { RouteComparison } from '../components/RouteComparison';
import { ScenarioFan } from '../components/ScenarioFan';
import { VoiMapOverlay } from '../components/VoiMapOverlay';
import { CardSkeleton } from '../components/Skeleton';
import { EmptyState, ErrorState } from '../components/StateViews';

function isInfeasibility(detail: unknown): detail is InfeasibilityDiagnostic {
  return !!detail && typeof detail === 'object' && (detail as { status?: string }).status === 'INFEASIBLE';
}

export const AllocationDashboard: React.FC = () => {
  const { activeScenarioId, activeScenario, scenarioDetail, activePlan, setActivePlan, activeRole, notify } = useApp();

  const [optimizing, setOptimizing] = useState(false);
  const [mode, setMode] = useState<'robust' | 'baseline'>('robust');
  const [infeasibility, setInfeasibility] = useState<InfeasibilityDiagnostic | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRouteRank, setSelectedRouteRank] = useState(1);
  const [selectedVoiEdge, setSelectedVoiEdge] = useState<string | null>(null);

  const canOptimize = activeRole === 'analyst' || activeRole === 'admin';

  const fan = useAsync(
    () => (activeScenarioId ? fetchScenarioFan(activeScenarioId, 50) : Promise.resolve(null)),
    [activeScenarioId],
  );
  const voi = useAsync(
    () => (activeScenarioId ? fetchVoiRankings(activeScenarioId, 5) : Promise.resolve(null)),
    [activeScenarioId, activePlan?.plan_id],
  );

  // Show alternatives for the first trip of the active plan
  const firstTrip = activePlan?.vehicle_routes.find((r) => r.depot_id && r.destination_node_id);
  const routes = useAsync(
    () =>
      activeScenarioId && firstTrip?.depot_id && firstTrip.destination_node_id
        ? fetchRouteAlternatives(activeScenarioId, firstTrip.depot_id, firstTrip.destination_node_id, 3, firstTrip.vehicle_id)
        : Promise.resolve(null),
    [activeScenarioId, firstTrip?.depot_id, firstTrip?.destination_node_id, firstTrip?.vehicle_id],
  );

  const destinationName = useMemo(
    () => scenarioDetail?.demand_nodes.find((n) => n.id === firstTrip?.destination_node_id)?.name ?? firstTrip?.destination_node_id ?? '',
    [scenarioDetail, firstTrip],
  );

  const handleOptimize = async () => {
    setOptimizing(true);
    setErrorMsg(null);
    setInfeasibility(null);
    try {
      const plan = await optimizePlan(activeScenarioId, mode);
      setActivePlan(plan);
      notify(`Plan generated (${plan.solver_status.toLowerCase().replace(/_/g, ' ')} in ${plan.solve_time_seconds}s). Submit it from the Overview to request sign-off.`, 'success');
    } catch (err) {
      if (err instanceof ApiError && isInfeasibility(err.detail)) {
        setInfeasibility(err.detail);
        notify('The model is infeasible under the current constraints. See the explanation below.', 'error');
      } else {
        setErrorMsg(errorMessage(err));
      }
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="glass-card p-6 rounded-3xl shadow-glass-card border border-palette-frost/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {activeScenario && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full glass-card-subtle text-palette-cream border border-palette-frost/30 font-mono">
              {activeScenario.name}
            </span>
          )}
          <h1 className="text-xl font-extrabold text-palette-cream mt-1 tracking-tight">Relief Distribution &amp; Dispatch</h1>
          <p className="text-xs text-palette-frost mt-0.5">
            Equity-constrained allocation, route risk and where to inspect next.
          </p>
        </div>

        {canOptimize ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex glass-card-subtle p-1 rounded-2xl border border-palette-frost/25 text-xs" role="group" aria-label="Solver mode">
              {(
                [
                  ['robust', 'Robust CP-SAT'],
                  ['baseline', 'Proportional baseline'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mode === id}
                  onClick={() => setMode(id)}
                  className={`px-3.5 py-1.5 font-semibold rounded-xl transition-all min-h-[36px] ${
                    mode === id ? 'glass-btn-primary text-palette-cream' : 'text-palette-frost hover:text-palette-cream'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={optimizing || !activeScenarioId}
              onClick={handleOptimize}
              className="px-5 py-2 text-sm font-bold rounded-2xl text-white shadow-glass-card flex items-center space-x-2 min-h-[44px] glass-btn-primary disabled:opacity-60"
            >
              <Cpu className="w-4 h-4 text-palette-frost" />
              <span>{optimizing ? 'Solving...' : 'Run optimization'}</span>
            </button>
          </div>
        ) : (
          <p className="text-xs text-palette-frost max-w-xs">Only analysts can run the optimizer. You can review the latest plan below.</p>
        )}
      </div>

      {errorMsg && <ErrorState message={errorMsg} />}

      {(activePlan || infeasibility) && (
        <SolverDiagnostics
          solverStatus={infeasibility ? 'INFEASIBLE' : (activePlan?.solver_status ?? 'READY')}
          solveTimeSeconds={activePlan?.solve_time_seconds ?? 0}
          snapshotId={activePlan?.snapshot_id ?? scenarioDetail?.snapshot_id ?? ''}
          infeasibilityDiagnostic={infeasibility}
        />
      )}

      {!activePlan && !infeasibility && (
        <EmptyState title="No plan yet" hint={canOptimize ? 'Run the optimization to generate the first plan.' : 'An analyst has not generated a plan yet.'} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {fan.error ? (
          <ErrorState message={fan.error} onRetry={fan.reload} />
        ) : fan.data ? (
          <div className="space-y-3">
            <ScenarioFan
              numSamples={fan.data.num_samples}
              meanPassability={fan.data.mean_passability}
              worstCaseP05={fan.data.worst_case_p05}
              bestCaseP95={fan.data.best_case_p95}
              samplingDurationMs={fan.data.sampling_duration_ms}
              sampleSurvivalRates={fan.data.sample_survival_rates}
            />
            <dl className="grid grid-cols-3 gap-3 text-center text-xs">
              {(
                [
                  ['Nominal plan loss', fan.data.deterministic_loss],
                  ['Recourse plan loss', fan.data.recourse_loss],
                  ['Worst-5% loss (CVaR)', fan.data.expected_shortfall_95],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="glass-card-subtle rounded-xl p-3">
                  <dt className="text-palette-frost">{label}</dt>
                  <dd className="text-base font-bold text-palette-cream font-mono">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : (
          <CardSkeleton lines={5} />
        )}

        {voi.error ? (
          <ErrorState message={voi.error} onRetry={voi.reload} />
        ) : voi.data && voi.data.targets.length > 0 ? (
          <VoiMapOverlay targets={voi.data.targets} selectedEdgeId={selectedVoiEdge} onSelectTarget={setSelectedVoiEdge} />
        ) : voi.loading ? (
          <CardSkeleton lines={5} />
        ) : null}
      </div>

      {routes.data && routes.data.routes.length > 0 && firstTrip && (
        <RouteComparison
          vehicleId={firstTrip.vehicle_id}
          destinationName={destinationName}
          routes={routes.data.routes}
          selectedRank={selectedRouteRank}
          onSelectRoute={setSelectedRouteRank}
        />
      )}

      {activePlan && (
        <>
          <EquityMetrics equity={activePlan.equity_evaluation} />
          <AllocationTable allocations={activePlan.allocations} unmetDemands={activePlan.unmet_demands} />
          {voi.data && <CriticalEdges recommendations={voi.data.targets} />}
        </>
      )}
    </div>
  );
};

export default AllocationDashboard;
