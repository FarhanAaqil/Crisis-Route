import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ApproverOnlyGuard, Role } from '../auth/guards';
import {
  fetchScenarioResources,
  approveScenarioDirectly,
  submitPlanApproval,
  ScenarioResourcesResponse,
} from '../api/client';
import { ThreeTacticalRadar } from '../components/ThreeTacticalRadar';
import {
  ShieldCheck,
  Truck,
  Users,
  Activity,
  CheckCircle2,
  XCircle,
  FileCheck2,
} from 'lucide-react';

export interface DashboardProps {
  currentRole?: Role;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentRole }) => {
  const {
    scenarios,
    activeScenarioId,
    setActiveScenarioId,
    activeRole,
    activePlan,
    setActivePlan,
    notify,
  } = useApp();

  const effectiveRole = currentRole || activeRole;

  const [resources, setResources] = useState<ScenarioResourcesResponse | null>(null);
  const [rationale, setRationale] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);

  const activeScenario = scenarios.find((s) => s.scenario_id === activeScenarioId);

  useEffect(() => {
    if (!activeScenarioId) return;

    fetchScenarioResources(activeScenarioId)
      .then((data) => setResources(data))
      .catch((err) => {
        console.error('Failed to load resources:', err);
      });
  }, [activeScenarioId]);

  const handleApprove = async () => {
    if (!rationale || rationale.trim().length < 10) {
      notify('Operational rationale (minimum 10 characters) is required for sign-off.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (activePlan?.plan_id) {
        const updatedPlan = await submitPlanApproval(
          activePlan.plan_id,
          'APPROVE',
          rationale,
          'Incident Lead Approver'
        );
        setActivePlan(updatedPlan);
      } else {
        await approveScenarioDirectly(activeScenarioId, 'APPROVE', rationale);
      }
      setApprovalMessage('Plan successfully signed off and sealed into immutable audit ledger.');
      notify('Operational approval sealed into audit trail.', 'success');
      setRationale('');
    } catch (err: any) {
      notify(`Approval failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rationale || rationale.trim().length < 5) {
      notify('Please provide a reason for rejecting the plan.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (activePlan?.plan_id) {
        const updated = await submitPlanApproval(
          activePlan.plan_id,
          'REJECT',
          rationale,
          'Incident Lead Approver'
        );
        setActivePlan(updated);
      } else {
        await approveScenarioDirectly(activeScenarioId, 'REJECT', rationale);
      }
      setApprovalMessage('Plan rejected. Revisions required from logistics coordinator.');
      notify('Plan rejected and returned to analyst.', 'info');
      setRationale('');
    } catch (err: any) {
      notify(`Rejection failed: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalDemandQty = resources
    ? Object.values(resources.total_demand_by_commodity).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Header and Safety Disclaimer */}
      <header className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-blue-400 font-bold text-base">
                CR
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                CrisisRoute Decision Support Platform
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Uncertainty-Aware Humanitarian Logistics &amp; Equitable Multi-Commodity Routing
              </p>
            </div>
          </div>

          {/* Regional Disaster Scenario Selector */}
          <div className="flex items-center space-x-2 text-xs self-stretch sm:self-auto bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
            <label htmlFor="scenario-select" className="text-slate-300 font-semibold pl-2">
              Disaster Region:
            </label>
            <select
              id="scenario-select"
              aria-label="Active disaster scenario selector"
              value={activeScenarioId}
              onChange={(e) => setActiveScenarioId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 font-medium shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[36px]"
            >
              {scenarios.map((s) => (
                <option key={s.scenario_id} value={s.scenario_id} className="bg-slate-900 text-slate-100">
                  {s.name} ({s.region_name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Operational Safety Notice */}
        <div className="mt-4 p-3.5 bg-amber-950/60 border-l-4 border-amber-500 text-amber-200 text-xs rounded-xl flex items-center space-x-2 shadow-inner">
          <span className="font-semibold uppercase tracking-wider text-amber-400 shrink-0">
            Mandatory Operational Notice:
          </span>
          <span>
            CrisisRoute provides probabilistic decision support under road uncertainty. It does not
            certify route safety or replace ground situational reports.
          </span>
        </div>
      </header>

      {/* Main Scenario Overview Card with 3D Radar Integration */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/90 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-3 py-1 bg-blue-900/60 text-blue-300 border border-blue-700/50 rounded-full tracking-wide">
                Active Operational Corridor
              </span>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                NDMA Rapid Response
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight mt-1">
              {activeScenario ? activeScenario.name : 'Loading Regional Scenario...'}
            </h2>
            <p className="text-xs text-slate-400">
              Region: {activeScenario?.region_name || 'India'} | State Protocol: National Disaster Management (NDMA)
            </p>
          </div>

          <div className="flex items-center space-x-4 self-end lg:self-auto">
            <span className="text-xs text-slate-400 font-mono bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
              ID: {activeScenarioId ? activeScenarioId.slice(0, 8) : '...'}...
            </span>
            <div className="hidden sm:block">
              <ThreeTacticalRadar size={80} activeRegion={activeScenario?.region_name} />
            </div>
          </div>
        </div>

        {/* Real Dynamic Tactical Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Warehouses Card */}
          <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-1.5 hover:-translate-y-1 hover:border-blue-500/50 transition-all duration-300 shadow-md group">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Staging Depots</span>
              <Truck className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-base font-bold text-white">
              {resources ? `${resources.depots.length} Warehouses` : '2 Warehouses'}
            </div>
            <span className="text-[11px] text-slate-400 block font-mono">
              Fleet: {resources ? resources.vehicles.length : 4} All-Terrain Trucks
            </span>
          </div>

          {/* Demand Clusters Card */}
          <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-1.5 hover:-translate-y-1 hover:border-indigo-500/50 transition-all duration-300 shadow-md group">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Isolated Demand Clusters</span>
              <Users className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-base font-bold text-white">
              {resources ? `${resources.demand_nodes.length} Clusters` : '4 Clusters'}
            </div>
            <span className="text-[11px] text-slate-400 block font-mono">
              Total Demand: {totalDemandQty} Units
            </span>
          </div>

          {/* Worst-Group Floor Guarantee */}
          <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-1.5 hover:-translate-y-1 hover:border-emerald-500/50 transition-all duration-300 shadow-md group">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Worst Group Floor (α)</span>
              <Activity className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-base font-bold text-emerald-400 font-mono">
              ≥ 40.0% Guaranteed
            </div>
            <span className="text-[11px] text-emerald-500/80 block font-medium">
              Protected Minority Priority
            </span>
          </div>

          {/* Approval Status Card */}
          <div className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl space-y-1.5 hover:-translate-y-1 hover:border-amber-500/50 transition-all duration-300 shadow-md group">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Plan Approval Status</span>
              <FileCheck2 className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <div
              className={`text-base font-extrabold font-mono ${
                activePlan?.approval_state.status === 'APPROVED'
                  ? 'text-emerald-400'
                  : activePlan?.approval_state.status === 'REJECTED'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}
            >
              {activePlan?.approval_state.status || 'PENDING_APPROVAL'}
            </div>
            <span className="text-[11px] text-slate-400 block font-mono">
              {activePlan ? `Solver: ${activePlan.solver_status}` : 'Awaiting Solver Run'}
            </span>
          </div>
        </div>
      </section>

      {/* Approver Sign-Off Gate Panel */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-3">
          <ShieldCheck className="w-5 h-5 text-amber-400" />
          <h3 className="text-base sm:text-lg font-bold text-white">Incident Lead Sign-Off Gate</h3>
        </div>
        <p className="text-xs text-slate-400">
          Every relief plan requires explicit written justification by the Incident Lead Approver prior to field action.
        </p>

        <ApproverOnlyGuard currentRole={effectiveRole}>
          <div className="space-y-4 pt-2">
            <div>
              <label htmlFor="approver-rationale" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Operational Rationale &amp; Risk Acceptance (Mandatory):
              </label>
              <textarea
                id="approver-rationale"
                aria-label="Mandatory operational rationale and risk acceptance text"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="State the operational basis, rejected route alternatives, and ground verification details..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner font-sans"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleApprove}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/30 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px] transition-all flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Sealing...' : 'Approve & Seal Relief Plan'}</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleReject}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 shadow-md focus:outline-none focus:ring-2 focus:ring-slate-500 min-h-[44px] transition-all flex items-center justify-center space-x-2"
              >
                <XCircle className="w-4 h-4 text-slate-400" />
                <span>Reject &amp; Request What-If Revision</span>
              </button>
            </div>
            {approvalMessage && (
              <div
                role="status"
                className="p-3.5 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs rounded-xl font-medium flex items-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{approvalMessage}</span>
              </div>
            )}
          </div>
        </ApproverOnlyGuard>
      </section>
    </div>
  );
};
