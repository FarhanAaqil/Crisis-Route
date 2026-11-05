import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  InfeasibilityDiagnostic,
  PlanDetail,
  optimizePlan,
  submitPlanApproval,
  fetchRouteAlternatives,
  fetchScenarioFan,
  fetchVoiRankings,
  RouteOption,
  ReconnaissanceRecommendation,
  ScenarioFanResponse,
} from '../api/client';
import { AllocationTable } from '../components/AllocationTable';
import { CriticalEdges } from '../components/CriticalEdges';
import { EquityMetrics } from '../components/EquityMetrics';
import { SolverDiagnostics } from '../components/SolverDiagnostics';
import { RouteComparison } from '../components/RouteComparison';
import { ScenarioFan } from '../components/ScenarioFan';
import { VoiMapOverlay } from '../components/VoiMapOverlay';

export interface AllocationDashboardProps {
  scenarioId?: string;
  initialPlan?: PlanDetail | null;
}

export const AllocationDashboard: React.FC<AllocationDashboardProps> = ({
  scenarioId: propScenarioId,
  initialPlan = null,
}) => {
  const {
    activeScenarioId: contextScenarioId,
    activeScenario,
    activePlan: contextPlan,
    setActivePlan: setContextPlan,
    notify,
  } = useApp();

  const scenarioId = propScenarioId || contextScenarioId || 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';

  const [activePlan, setActivePlan] = useState<PlanDetail | null>(initialPlan || contextPlan);
  const [optimizing, setOptimizing] = useState(false);
  const [mode, setMode] = useState<'robust' | 'baseline'>('robust');
  const [infeasibilityDiag, setInfeasibilityDiag] = useState<InfeasibilityDiagnostic | null>(null);
  const [approvalRationale, setApprovalRationale] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Intelligence state
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRouteRank, setSelectedRouteRank] = useState<number>(1);
  const [fanData, setFanData] = useState<ScenarioFanResponse | null>(null);
  const [voiTargets, setVoiTargets] = useState<ReconnaissanceRecommendation[]>([]);
  const [selectedVoiEdge, setSelectedVoiEdge] = useState<string | null>(null);

  // Sync with context plan
  useEffect(() => {
    if (contextPlan) {
      setActivePlan(contextPlan);
      setApprovalStatus(contextPlan.approval_state.status);
    }
  }, [contextPlan]);

  // Fetch intelligence data (Scenario Fan & VoI Rankings)
  useEffect(() => {
    if (!scenarioId) return;

    fetchScenarioFan(scenarioId, 50)
      .then((data) => setFanData(data))
      .catch((err) => console.warn('Could not load scenario fan:', err));

    fetchVoiRankings(scenarioId, 5)
      .then((res) => setVoiTargets(res.targets))
      .catch((err) => console.warn('Could not load VoI rankings:', err));
  }, [scenarioId]);

  // Fetch route alternatives when vehicles and destinations are present
  useEffect(() => {
    if (!scenarioId || !activePlan || activePlan.vehicle_routes.length === 0) return;

    const firstRoute = activePlan.vehicle_routes[0];
    const origin = 'DEPOT-KALPETTA';
    const dest = activePlan.allocations.length > 0 ? activePlan.allocations[0].demand_node_id : 'NODE-MEPPADI-ISOLATED';

    fetchRouteAlternatives(scenarioId, origin, dest, 3, firstRoute.vehicle_id)
      .then((res) => {
        setRoutes(res.routes);
        setSelectedRouteRank(1);
      })
      .catch((err) => console.warn('Could not load route alternatives:', err));
  }, [scenarioId, activePlan]);

  const handleOptimize = async () => {
    setOptimizing(true);
    setErrorMsg(null);
    setInfeasibilityDiag(null);

    try {
      const plan = await optimizePlan(scenarioId, mode);
      setActivePlan(plan);
      setContextPlan(plan);
      setApprovalStatus(plan.approval_state.status);
      notify(`CP-SAT optimization solved successfully (${plan.solver_status} in ${plan.solve_time_seconds}s)`, 'success');
    } catch (err: any) {
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.status === 'INFEASIBLE') {
          setInfeasibilityDiag(parsed);
          notify('Model proven infeasible under current constraints', 'error');
        } else {
          setErrorMsg(err.message);
          notify(`Optimization error: ${err.message}`, 'error');
        }
      } catch {
        setErrorMsg(err.message || 'Optimization failed');
        notify('Optimization failed', 'error');
      }
    } finally {
      setOptimizing(false);
    }
  };

  const handleApproval = async (decision: 'APPROVE' | 'REJECT') => {
    if (!activePlan) return;
    if (!approvalRationale.trim() || approvalRationale.trim().length < 10) {
      notify('A written operational rationale of at least 10 characters is mandatory.', 'error');
      return;
    }

    try {
      const updated = await submitPlanApproval(
        activePlan.plan_id,
        decision,
        approvalRationale,
        'Farhan Aaqil'
      );
      setActivePlan(updated);
      setContextPlan(updated);
      setApprovalStatus(updated.approval_state.status);
      notify(`Relief plan ${decision === 'APPROVE' ? 'authorized' : 'rejected'} and sealed.`, 'success');
      setApprovalRationale('');
    } catch (err: any) {
      notify(`Approval submission failed: ${err.message}`, 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header & Optimization Control Bar */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
            {activeScenario?.name || 'Regional Relief Corridor'}
          </span>
          <h1 className="text-xl font-bold text-slate-800 mt-1">
            Relief Distribution &amp; Operational Dispatch
          </h1>
          <p className="text-xs text-slate-500">
            Automated CP-SAT equity optimization, route risk mitigation, and Incident Lead approval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mode === 'robust'
                  ? 'bg-white shadow-sm text-blue-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setMode('robust')}
            >
              Robust CP-SAT
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                mode === 'baseline'
                  ? 'bg-white shadow-sm text-blue-700'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              onClick={() => setMode('baseline')}
            >
              Proportional Baseline
            </button>
          </div>

          <button
            type="button"
            disabled={optimizing}
            onClick={handleOptimize}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg text-white shadow-sm transition-all ${
              optimizing
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {optimizing ? 'Solving CP-SAT...' : 'Run Optimization'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Solver Diagnostics View */}
      <SolverDiagnostics
        solverStatus={activePlan ? activePlan.solver_status : infeasibilityDiag ? 'INFEASIBLE' : 'READY'}
        solveTimeSeconds={activePlan ? activePlan.solve_time_seconds : 0.0}
        snapshotId={activePlan ? activePlan.snapshot_id : 'e3b0c44298fc1c14...'}
        infeasibilityDiagnostic={infeasibilityDiag}
      />

      {/* Stochastic Monte Carlo Fan and VoI Overlay Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {fanData && (
          <ScenarioFan
            numSamples={fanData.num_samples}
            meanPassability={fanData.mean_passability}
            worstCaseP05={fanData.worst_case_p05}
            bestCaseP95={fanData.best_case_p95}
            samplingDurationMs={fanData.sampling_duration_ms}
            sampleSurvivalRates={fanData.sample_survival_rates}
          />
        )}

        {voiTargets.length > 0 && (
          <VoiMapOverlay
            targets={voiTargets}
            selectedEdgeId={selectedVoiEdge}
            onSelectTarget={(eid) => setSelectedVoiEdge(eid)}
          />
        )}
      </div>

      {/* Alternative Routes Comparison */}
      {routes.length > 0 && (
        <RouteComparison
          vehicleId={activePlan?.vehicle_routes[0]?.vehicle_id || 'VEH-KSRTC-4WD-01'}
          destinationName="Meppadi Relief Camp"
          routes={routes}
          selectedRank={selectedRouteRank}
          onSelectRoute={(r) => setSelectedRouteRank(r)}
        />
      )}

      {activePlan && (
        <>
          {/* Equity & Deprivation Overview */}
          <EquityMetrics equity={activePlan.equity_evaluation} />

          {/* Allocation Breakdown Table */}
          <AllocationTable
            allocations={activePlan.allocations}
            unmetDemands={activePlan.unmet_demands}
          />

          {/* Critical Reconnaissance Edges */}
          <CriticalEdges recommendations={activePlan.reconnaissance_recommendations} />

          {/* Human Incident Lead Approval Gate */}
          <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-800">
                  Incident Lead Sign-Off Gate
                </h3>
                <p className="text-xs text-slate-500">
                  Mandatory operational justification before field dispatch authorization.
                </p>
              </div>
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  approvalStatus === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : approvalStatus === 'REJECTED'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                Status: {approvalStatus || activePlan.approval_state.status}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="operational-rationale"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Operational Decision Rationale (Mandatory &ge; 10 chars):
                </label>
                <textarea
                  id="operational-rationale"
                  rows={2}
                  className="w-full text-xs sm:text-sm border border-slate-300 rounded p-2.5 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Approved deployment after verifying flood bypass corridors along Wayanad NH766."
                  value={approvalRationale}
                  onChange={(e) => setApprovalRationale(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 justify-end">
                <button
                  type="button"
                  className="px-4 py-2 text-xs font-bold rounded bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                  onClick={() => handleApproval('REJECT')}
                >
                  Reject Plan
                </button>
                <button
                  type="button"
                  className="px-5 py-2 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
                  onClick={() => handleApproval('APPROVE')}
                >
                  Authorize Field Dispatch
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
