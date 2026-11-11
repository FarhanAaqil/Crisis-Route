import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  InfeasibilityDiagnostic,
  PlanDetail,
  optimizePlan,
  submitPlanApproval,
  submitPlanForApproval,
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
import { Cpu, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

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
      const generated = await optimizePlan(scenarioId, mode);
      // A second person must sign it off, so hand it over right away
      const plan = await submitPlanForApproval(generated.plan_id);
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
      <div className="glass-card p-6 rounded-3xl shadow-glass-card border border-palette-frost/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full glass-card-subtle text-palette-cream border border-palette-frost/30 font-mono">
            {activeScenario?.name || 'Regional Relief Corridor'}
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold text-palette-cream mt-1 tracking-tight">
            Relief Distribution &amp; Operational Dispatch
          </h1>
          <p className="text-xs text-palette-frost mt-0.5">
            Automated CP-SAT equity optimization, route risk mitigation, and Incident Lead approval.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex glass-card-subtle p-1 rounded-2xl border border-palette-frost/25 text-xs">
            <button
              type="button"
              className={`px-3.5 py-1.5 font-bold rounded-xl transition-all min-h-[36px] ${
                mode === 'robust'
                  ? 'glass-btn-primary shadow-glass-card text-palette-cream'
                  : 'text-palette-frost hover:text-palette-cream'
              }`}
              onClick={() => setMode('robust')}
            >
              Robust CP-SAT
            </button>
            <button
              type="button"
              className={`px-3.5 py-1.5 font-medium rounded-xl transition-all min-h-[36px] ${
                mode === 'baseline'
                  ? 'glass-btn-primary shadow-glass-card text-palette-cream'
                  : 'text-palette-frost hover:text-palette-cream'
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
            className={`px-5 py-2 text-xs sm:text-sm font-bold rounded-2xl text-white shadow-glass-card transition-all flex items-center space-x-2 min-h-[44px] ${
              optimizing
                ? 'bg-palette-steel/50 cursor-not-allowed text-palette-frost'
                : 'glass-btn-primary hover:border-palette-frost/60 active:scale-95'
            }`}
          >
            <Cpu className="w-4 h-4 text-palette-frost" />
            <span>{optimizing ? 'Solving CP-SAT Model...' : 'Run Optimization'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-2xl text-xs font-medium shadow-glass-card">
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

          {/* Critical Edges & Sensitivity Analysis */}
          <CriticalEdges recommendations={voiTargets} />

          {/* Incident Lead Operational Sign-Off Panel */}
          <div className="glass-card rounded-3xl p-6 sm:p-7 shadow-glass-card space-y-4">
            <div className="flex items-center justify-between border-b border-palette-slate/25 pb-3">
              <div>
                <h3 className="text-base font-bold text-palette-cream flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span>Incident Lead Operational Sign-Off Gate</span>
                </h3>
                <p className="text-xs text-palette-frost">
                  Every dispatch action requires explicit written operational rationale to seal into the cryptographic audit trail.
                </p>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                  approvalStatus === 'APPROVED'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40'
                    : approvalStatus === 'REJECTED'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-800/40'
                }`}
              >
                {approvalStatus || 'PENDING_APPROVAL'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="plan-approval-rationale" className="block text-xs font-semibold text-palette-cream mb-1.5">
                  Operational Rationale &amp; Risk Acceptance (Mandatory):
                </label>
                <textarea
                  id="plan-approval-rationale"
                  aria-label="Mandatory operational rationale and risk acceptance text"
                  value={approvalRationale}
                  onChange={(e) => setApprovalRationale(e.target.value)}
                  placeholder="Provide operational justification, address potential road blockages, and confirm ground patrol verification before authorizing convoy dispatch..."
                  className="w-full glass-input rounded-2xl p-3.5 text-xs text-palette-cream placeholder-palette-slate h-24 focus:outline-none focus:ring-2 focus:ring-palette-frost shadow-inner"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => handleApproval('APPROVE')}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600/90 to-emerald-500/90 hover:from-emerald-500 hover:to-emerald-400 active:scale-95 text-white text-xs font-bold rounded-2xl shadow-glass-card border border-emerald-400/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 min-h-[44px] transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve &amp; Seal Relief Plan</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApproval('REJECT')}
                  className="px-6 py-2.5 glass-card-subtle hover:bg-palette-steel/50 active:scale-95 text-palette-cream border border-palette-frost/25 text-xs font-semibold rounded-2xl shadow-glass-card focus:outline-none focus:ring-2 focus:ring-palette-frost min-h-[44px] transition-all flex items-center justify-center space-x-2"
                >
                  <XCircle className="w-4 h-4 text-palette-frost" />
                  <span>Reject &amp; Request What-If Revision</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
